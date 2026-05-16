import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import dns from 'dns';
import axios from 'axios';
import fs from 'fs';
import path from 'path';


// Force IPv4 as priority for DNS resolution (critical for Render/Gmail SMTP)
dns.setDefaultResultOrder('ipv4first');

export class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private initPromise: Promise<void> | null = null;
    private useSendgrid = false;
    private sendgridApiKey: string | undefined;
    private defaultFromEmail: string | undefined;

    private readonly commonFreeEmailDomains = new Set([
        'gmail.com',
        'googlemail.com',
        'outlook.com',
        'hotmail.com',
        'live.com',
        'yahoo.com',
        'icloud.com'
    ]);

    constructor() {
        this.initPromise = this.init();
    }

    private extractDomain(email?: string): string | null {
        if (!email) return null;
        const parts = email.trim().toLowerCase().split('@');
        if (parts.length !== 2 || !parts[1]) return null;
        return parts[1];
    }

    private isFreeMailboxDomain(email?: string): boolean {
        const domain = this.extractDomain(email);
        return !!domain && this.commonFreeEmailDomains.has(domain);
    }

    public async init() {
        if (this.transporter) return;

        // Determine if we're running on Render (or a similar hosted env).
        // Render sets env vars like RENDER, RENDER_SERVICE_ID or RENDER_INTERNAL_HOSTNAME.
        const runningOnRender = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_INTERNAL_HOSTNAME);

        // Prefer HTTP-based provider (SendGrid) when on Render and API key is provided.
        // Locally we'll keep using nodemailer (SMTP or Ethereal) unless explicitly forced.
        const forceSendGrid = process.env.FORCE_SENDGRID === 'true';
        if ((runningOnRender || forceSendGrid) && process.env.SENDGRID_API_KEY) {
            this.useSendgrid = true;
            this.sendgridApiKey = process.env.SENDGRID_API_KEY;
            this.defaultFromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'support@smartfare.com';

            if (this.isFreeMailboxDomain(this.defaultFromEmail)) {
                console.warn('⚠️ EMAIL_FROM usa un provider gratuito con SendGrid. Questa configurazione causa spesso spam per mancato allineamento DMARC. Usa un indirizzo del tuo dominio autenticato (SPF/DKIM), ad esempio noreply@tuodominio.it');
            }

            console.log('✅ SendGrid provider abilitato (HTTP API) - runningOnRender=', runningOnRender, 'force=', forceSendGrid);
            return;
        }

        // Usa le variabili d'ambiente in produzione via SMTP, altrimenti crea un test account con Ethereal
        if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
            const port = parseInt(process.env.SMTP_PORT);
            const options: any = {
                host: process.env.SMTP_HOST,
                port: port,
                secure: port === 465, // true for 465, false for other ports (587)
                family: 4, // Force IPv4 to avoid ENETUNREACH issues on cloud providers
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
                tls: {
                    // Help with some SMTP servers requiring starttls
                    rejectUnauthorized: false
                }
            };
            this.transporter = nodemailer.createTransport(options);

            try {
                await this.transporter.verify();
                console.log("✅ SMTP Transporter pronto e verificato");
            } catch (err) {
                console.error("❌ Errore durante la verifica del transporter SMTP:", err);
            }
        } else {
            console.warn("⚠️ Nessun SMTP_HOST/PORT trovato, generazione Ethereal test account in corso...");
            try {
                const testAccount = await nodemailer.createTestAccount();
                const options: any = {
                    host: "smtp.ethereal.email",
                    port: 587,
                    secure: false,
                    family: 4,
                    auth: {
                        user: testAccount.user,
                        pass: testAccount.pass,
                    },
                };
                this.transporter = nodemailer.createTransport(options);

                console.log(`✅ Ethereal test account pronto: ${testAccount.user}`);

            } catch (err) {
                console.error("❌ Errore durante la creazione dell'account Ethereal", err);
            }
        }
    }


    private async ensureTransporter() {
        if (!this.transporter) {
            if (this.initPromise) {
                await this.initPromise;
            } else {
                await this.init();
            }
        }

        // If SendGrid is enabled we don't require a nodemailer transporter
        if (!this.transporter && !this.useSendgrid) {
            throw new Error("Transporter email non inizializzato");
        }
    }


    public async sendPasswordResetEmail(to: string, resetLink: string) {
        await this.ensureTransporter();
        if (!this.transporter && !this.useSendgrid) return;

        const backendUrl = (process.env.BACKEND_URL || 'https://smartfare.nicolas-dominici.it').replace(/\/+$/, '');
        const logoUrl = `${backendUrl}/assets/logo.png`;

        let logoDataUri: string | null = null;
        try {
            const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo.png');
            if (fs.existsSync(logoPath)) {
                const img = fs.readFileSync(logoPath);
                logoDataUri = `data:image/png;base64,${img.toString('base64')}`;
            }
        } catch (e) {
            logoDataUri = null;
        }


        const textTemplate = `Ciao,

        Abbiamo ricevuto una richiesta di modifica della password per il tuo account SmartFare.
        
        Per scegliere una nuova password apri questo link:
        
        ${resetLink}
        
        Questo link sarà valido per 30 minuti.
        
        Se non hai richiesto questa operazione puoi ignorare questa email.
        
        SmartFare 
        support@smartfare.nicolas-dominici.it`;

        const htmlTemplate = `
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SmartFare - Reimposta Password</title>
        </head>
        
        <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#333333;">
        
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:30px 15px;">
            <tr>
              <td align="center">
        
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
                  style="background-color:#ffffff;border:1px solid #e6e6e6;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        
                  <!-- HEADER -->
                  <tr>
                    <td style="padding:30px 40px 20px 40px;">
        
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td valign="middle">
                            <img
                              src="https://smartfare-56lb.onrender.com/assets/logo.png"
                              alt="SmartFare"
                              width="42"
                              height="42"
                              style="display:block;border:0;outline:none;text-decoration:none;">
                          </td>
        
                          <td width="12"></td>
        
                          <td valign="middle">
                            <h1 style="margin:0;font-size:24px;font-weight:700;color:#111111;letter-spacing:1px;">
                              SMARTFARE
                            </h1>
                          </td>
                        </tr>
                      </table>
        
                    </td>
                  </tr>
        
                  <!-- LINE -->
                  <tr>
                    <td>
                      <div style="height:4px;background-color:#444444;"></div>
                    </td>
                  </tr>
        
                  <!-- CONTENT -->
                  <tr>
                    <td style="padding:35px 40px;">
        
                      <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;">
                        Ciao,
                      </p>
        
                      <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;">
                        Abbiamo ricevuto una richiesta per modificare la password del tuo account SmartFare.
                      </p>
        
                      <p style="margin:0 0 30px 0;font-size:16px;line-height:1.6;">
                        Per scegliere una nuova password, clicca sul pulsante qui sotto:
                      </p>
        
                      <!-- BUTTON -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
                        <tr>
                          <td align="center" bgcolor="#111111" style="border-radius:6px;">
                            <a href="${resetLink}"
                              target="_blank"
                              style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">
                              Reimposta la password
                            </a>
                          </td>
                        </tr>
                      </table>
        
                      <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#555555;">
                        Questo link sarà valido per 30 minuti.
                      </p>
        
                      <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;">
                        Se il pulsante non funziona, copia e incolla questo link nel browser:
                      </p>
        
                      <p style="margin:0 0 25px 0;font-size:13px;line-height:1.6;color:#666666;word-break:break-all;">
                        ${resetLink}
                      </p>
        
                      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
                        Se non hai richiesto questa operazione, puoi ignorare questa email.
                        La tua password rimarrà invariata.
                      </p>
        
                    </td>
                  </tr>
        
                  <!-- FOOTER -->
                  <tr>
                    <td style="padding:25px 40px;background-color:#fafafa;border-top:1px solid #eeeeee;">
        
                      <p style="margin:0 0 8px 0;font-size:12px;color:#888888;">
                        © 2026 Smartfare. Tutti i diritti riservati.
                      </p>
        
                      <p style="margin:0;font-size:12px;color:#888888;">
                        Supporto: support@smartfare.nicolas-dominici.it
                      </p>
        
                    </td>
                  </tr>
        
                </table>
        
              </td>
            </tr>
          </table>
        
        </body>
        </html>
        `;

        try {
            const smtpFrom = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
            const fromEmail = smtpFrom
                ? `"SmartFare (no-reply)" <${smtpFrom}>`
                : '"SmartFare (no-reply)" <support@smartfare.com>';
            // If SendGrid is configured, send via HTTP API instead of SMTP
            if (this.useSendgrid && this.sendgridApiKey) {
                const sgFrom = this.defaultFromEmail || 'support@smartfare.com';
                const payload = {
                    personalizations: [{
                        to: [{ email: to }],
                        subject: 'Recupero Password Account - SmartFare '
                    }],
                    from: { email: sgFrom, name: 'SmartFare (no-reply)' },
                    content: [
                        { type: 'text/plain', value: textTemplate },
                        { type: 'text/html', value: htmlTemplate }
                    ],
                    headers: {
                        'Auto-Submitted': 'auto-generated',
                        'Precedence': 'bulk'
                    },
                    categories: ['password-reset'],
                    tracking_settings: {
                        click_tracking: { enable: false },
                        open_tracking: { enable: false },
                        subscription_tracking: { enable: false }
                    }
                };

                try {
                    const resp = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
                        headers: {
                            Authorization: `Bearer ${this.sendgridApiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log('✅ Message sent via SendGrid, status:', resp.status);
                    return;
                } catch (sgError: any) {
                    console.error('❌ SendGrid error:', sgError.response?.data || sgError.message);
                    throw sgError;
                }
            }

            const info = await this.transporter!.sendMail({
                from: fromEmail,
                to: to,
                subject: "Recupero Password Account - SmartFare ",
                text: textTemplate,
                html: htmlTemplate
                ,
                headers: {
                    'Auto-Submitted': 'auto-generated',
                    'Precedence': 'bulk'
                }
            });

            console.log("Message sent: %s", info.messageId);
            const testUrl = nodemailer.getTestMessageUrl(info);
            if (testUrl) {
                console.log("Preview URL: %s", testUrl);
            }
        } catch (error) {
            console.error("Errore durante l'invio dell'email:", error);
            throw new Error("Errore durante l'invio dell'email");
        }
    }

    public async sendVerificationEmail(to: string, verificationLink: string) {
        await this.ensureTransporter();
        if (!this.transporter && !this.useSendgrid) return;

        const backendUrl = (process.env.BACKEND_URL || 'https://smartfare.nicolas-dominici.it').replace(/\/+$/, '');
        const logoUrl = `${backendUrl}/assets/logo.png`;
        let logoDataUri: string | null = null;
        try {
            const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo.png');
            if (fs.existsSync(logoPath)) {
                const img = fs.readFileSync(logoPath);
                logoDataUri = `data:image/png;base64,${img.toString('base64')}`;
            }
        } catch (e) {
            logoDataUri = null;
        }

        const textTemplate = `Benvenuto su SmartFare!\n\nGrazie per esserti registrato. Per completare la registrazione e attivare il tuo account, verifica il tuo indirizzo email visitando questo link:\n${verificationLink}\n\nQuesto link scadrà tra 1 ora.\n\nSe non hai creato un account SmartFare, puoi ignorare questa email in tutta sicurezza.\n\nCordialmente,\nIl team SmartFare\n\n© 2026 Smartfare. Tutti i diritti riservati.`;

        const htmlTemplate = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifica Email</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background: #f4f4f4;">
    <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border: 1px solid #e0e0e0;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <img src="https://smartfare-56lb.onrender.com/assets/logo.png" alt="SmartFare" style="height:40px; width:40px; object-fit:contain;" />
            <h2 style="color: #000; margin: 0;">SMARTFARE</h2>
        </div>
        <hr style="border: none; border-top: 5px solid #666; margin: 20px 0;">
        
        <p>Benvenuto su SmartFare!</p>
        
        <p>Grazie per esserti registrato. Per completare la registrazione e attivare il tuo account, clicca sul pulsante qui sotto per verificare il tuo indirizzo email.</p>
        
        <p style="text-align: center;"><a href="${verificationLink}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Verifica Email</a></p>
        
        <p>Questo link scadrà tra 1 ora.</p>
        <p>Se non hai creato un account SmartFare, puoi ignorare questa email in tutta sicurezza.</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; margin-bottom: 0;">© 2026 Smartfare. Tutti i diritti riservati.</p>
        <p style="font-size: 12px; color: #999; margin-top: 5px;">Se non hai richiesto questa email, puoi ignorarla.</p>
    </div>
</body>
</html>`;

        try {
            const smtpFrom = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
            const fromEmail = smtpFrom
                ? `"SmartFare (no-reply)" <${smtpFrom}>`
                : '"SmartFare (no-reply)" <support@smartfare.com>';
            // Send via SendGrid if configured
            if (this.useSendgrid && this.sendgridApiKey) {
                const sgFrom = this.defaultFromEmail || 'support@smartfare.com';
                const payload = {
                    personalizations: [{
                        to: [{ email: to }],
                        subject: 'Verifica il tuo indirizzo email - SmartFare '
                    }],
                    from: { email: sgFrom, name: 'SmartFare (no-reply)' },
                    content: [
                        { type: 'text/plain', value: textTemplate },
                        { type: 'text/html', value: htmlTemplate }
                    ],
                    headers: {
                        'Auto-Submitted': 'auto-generated',
                        'Precedence': 'bulk'
                    },
                    categories: ['email-verification'],
                    tracking_settings: {
                        click_tracking: { enable: false },
                        open_tracking: { enable: false },
                        subscription_tracking: { enable: false }
                    }
                };

                try {
                    const resp = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
                        headers: {
                            Authorization: `Bearer ${this.sendgridApiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log('✅ Message sent via SendGrid, status:', resp.status);
                    return;
                } catch (sgError: any) {
                    console.error('❌ SendGrid error:', sgError.response?.data || sgError.message);
                    throw sgError;
                }
            }

            const info = await this.transporter!.sendMail({
                from: fromEmail,
                to: to,
                subject: "Verifica il tuo indirizzo email - SmartFare ",
                text: textTemplate,
                html: htmlTemplate
                ,
                headers: {
                    'Auto-Submitted': 'auto-generated',
                    'Precedence': 'bulk'
                }
            });

            console.log("Message sent: %s", info.messageId);
            const testUrl = nodemailer.getTestMessageUrl(info);
            if (testUrl) {
                console.log("Preview URL: %s", testUrl);
            }
        } catch (error) {
            console.error("Errore durante l'invio dell'email di verifica:", error);
            throw new Error("Errore durante l'invio dell'email di verifica");
        }
    }

    public async sendNewItineraryNotification(to: string, authorName: string, itineraryName: string, profileLink: string, itineraryImage: string) {
        await this.ensureTransporter();
        if (!this.transporter && !this.useSendgrid) return;

        const textTemplate = `Ciao! ${authorName} ha pubblicato un nuovo itinerario: ${itineraryName}.\nScopri di più sul suo profilo: ${profileLink}`;

        const htmlTemplate = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', Arial, sans-serif; color: #1f2937; line-height: 1.6; background: #f9fafb; margin:0; padding:40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 25px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        <!-- Header -->
        <div style="padding: 30px; text-align: center; background: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">SMARTFARE</h1>
            <p style="margin: 5px 0 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Community News</p>
        </div>

        <!-- Hero Image -->
        <div style="width: 100%; height: 280px; background: #f3f4f6; text-align:center; overflow:hidden;">
            <img src="${itineraryImage}" alt="${itineraryName}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
            <p style="margin: 0 0 10px; font-size: 14px; color: #6366f1; font-weight: 600; text-transform: uppercase;">Nuovo itinerario pubblicato</p>
            <h2 style="margin: 0 0 20px; font-size: 28px; line-height: 1.2; color: #111827; font-weight: 800;">${itineraryName}</h2>
            
            <p style="margin: 0 0 25px; font-size: 16px; color: #4b5563;">
                <strong>${authorName}</strong>, che segui su SmartFare, ha appena condiviso una nuova avventura. Non perderti i suoi consigli di viaggio e scopri i posti migliori da visitare!
            </p>

            <!-- CTA -->
            <div style="text-align: center; margin: 35px 0;">
                <a href="${profileLink}" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 16px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 16px; transition: background 0.2s;">
                    Guarda il Profilo
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="padding: 30px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                © 2026 Smartfare. <br>
                Hai ricevuto questa email perché segui <strong>${authorName}</strong>.
            </p>
        </div>
    </div>
</body>
</html>`;

        try {
            const smtpFrom = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
            const fromEmail = smtpFrom
                ? `"SmartFare Community" <${smtpFrom}>`
                : '"SmartFare Community" <support@smartfare.com>';

            if (this.useSendgrid && this.sendgridApiKey) {
                const sgFrom = this.defaultFromEmail || 'support@smartfare.com';
                const payload = {
                    personalizations: [{
                        to: [{ email: to }],
                        subject: `Nuovo itinerario da ${authorName} su SmartFare!`
                    }],
                    from: { email: sgFrom, name: 'SmartFare Community' },
                    content: [
                        { type: 'text/plain', value: textTemplate },
                        { type: 'text/html', value: htmlTemplate }
                    ],
                    tracking_settings: {
                        click_tracking: { enable: true },
                        open_tracking: { enable: true }
                    }
                };

                await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
                    headers: {
                        Authorization: `Bearer ${this.sendgridApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                return;
            }

            await this.transporter!.sendMail({
                from: fromEmail,
                to: to,
                subject: `Nuovo itinerario da ${authorName} su SmartFare!`,
                text: textTemplate,
                html: htmlTemplate
            });
        } catch (error) {
            console.error("Errore invio notifica follower:", error);
        }
    }
}
