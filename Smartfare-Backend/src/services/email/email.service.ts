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

        const backendUrl = (process.env.BACKEND_URL || 'https://smartfare.nicolas-dominici.it').replace(/\/+$/,'');
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
        

        const textTemplate = `Ciao,\n\nPer azzerare la password del tuo account SmartFare, visita questo link:\n${resetLink}\n\nSe avevi già effettuato una richiesta di modifica della password, solo il link contenuto in questa email è valido.\n\nSe invece non eri tu: Il tuo account SmartFare potrebbe essere stato compromesso. Se non hai ancora aggiunto la verifica in due passaggi al tuo account, ti consigliamo di attivarla subito per migliorare la sicurezza.\n\nCordialmente,\nIl team SmartFare\n\n© 2026 SmartFare Tickets. Tutti i diritti riservati.`;

        const htmlTemplate = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background: #f4f4f4;">
    <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border: 1px solid #e0e0e0;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <img src="${logoDataUri || logoUrl}" alt="SmartFare" style="height:40px; width:40px; object-fit:contain;" />
            <h2 style="color: #000; margin: 0;">SMARTFARE</h2>
        </div>
        <hr style="border: none; border-top: 5px solid #666; margin: 20px 0;">
        
        <p>Ciao,</p>
        
        <p>Per azzerare la password del tuo account SmartFare, clicca sul link qui sotto:</p>
        
        <p><a href="${resetLink}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Reimposta Password</a></p>
        
        <p>Se avevi già effettuato una richiesta di modifica della password, solo il link contenuto in questa email è valido.</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; margin-bottom: 0;">© 2026 SmartFare Tickets. Tutti i diritti riservati.</p>
        <p style="font-size: 12px; color: #999; margin-top: 5px;">Se non hai richiesto il reset della password, ignora questa email.</p>
    </div>
</body>
</html>`;

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
                        subject: 'Recupero Password Account - SmartFare Tickets'
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
                subject: "Recupero Password Account - SmartFare Tickets",
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

        const backendUrl = (process.env.BACKEND_URL || 'https://smartfare.nicolas-dominici.it').replace(/\/+$/,'');
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

        const textTemplate = `Benvenuto su SmartFare!\n\nGrazie per esserti registrato. Per completare la registrazione e attivare il tuo account, verifica il tuo indirizzo email visitando questo link:\n${verificationLink}\n\nQuesto link scadrà tra 1 ora.\n\nSe non hai creato un account SmartFare, puoi ignorare questa email in tutta sicurezza.\n\nCordialmente,\nIl team SmartFare\n\n© 2026 SmartFare Tickets. Tutti i diritti riservati.`;

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
            <img src="${logoDataUri || logoUrl}" alt="SmartFare" style="height:40px; width:40px; object-fit:contain;" />
            <h2 style="color: #000; margin: 0;">SMARTFARE</h2>
        </div>
        <hr style="border: none; border-top: 5px solid #666; margin: 20px 0;">
        
        <p>Benvenuto su SmartFare!</p>
        
        <p>Grazie per esserti registrato. Per completare la registrazione e attivare il tuo account, clicca sul pulsante qui sotto per verificare il tuo indirizzo email.</p>
        
        <p style="text-align: center;"><a href="${verificationLink}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Verifica Email</a></p>
        
        <p>Questo link scadrà tra 1 ora.</p>
        <p>Se non hai creato un account SmartFare, puoi ignorare questa email in tutta sicurezza.</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; margin-bottom: 0;">© 2026 SmartFare Tickets. Tutti i diritti riservati.</p>
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
                        subject: 'Verifica il tuo indirizzo email - SmartFare Tickets'
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
                subject: "Verifica il tuo indirizzo email - SmartFare Tickets",
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
}
