import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import dns from 'dns';
import axios from 'axios';


// Force IPv4 as priority for DNS resolution (critical for Render/Gmail SMTP)
dns.setDefaultResultOrder('ipv4first');

export class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private initPromise: Promise<void> | null = null;
    private useSendgrid = false;
    private sendgridApiKey: string | undefined;
    private defaultFromEmail: string | undefined;
    
    constructor() {
        this.initPromise = this.init();
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
            this.defaultFromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'support@smartfare.com';
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


        const htmlTemplate = `
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Password</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #333333;
                }
                .wrapper {
                    padding: 30px 15px;
                }
                .container {
                    background-color: #ffffff;
                    max-width: 600px;
                    margin: 0 auto;
                    border: 1px solid #e0e0e0;
                }
                .header {
                    padding: 20px 30px 15px;
                }
                .logo-text {
                    font-size: 28px;
                    font-weight: 900;
                    color: #000000;
                    margin: 0;
                    letter-spacing: -1px;
                    display: flex;
                    align-items: center;
                }
                .divider {
                    height: 5px;
                    background-color: #666666;
                    width: 100%;
                }
                .content {
                    padding: 40px 30px;
                    font-size: 15px;
                    line-height: 1.5;
                }
                .content p {
                    margin-bottom: 20px;
                    color: #333333;
                }
                .bold {
                    font-weight: bold;
                }
                a {
                    color: #0077cc;
                    text-decoration: underline;
                }
                .highlight {
                    background-color: #fff2cc;
                }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <div class="logo-text">
                            <img src="cid:smartfarelogo" alt="Logo" style="height: 36px; vertical-align: middle; margin-right: 12px; border: 0;" />
                            <span style="vertical-align: middle;">SMARTFARE</span>
                        </div>
                    </div>
                    <div class="divider"></div>
                    
                    <div class="content">
                        <p>Ciao,</p>
                        
                        <p>Per azzerare la password del tuo account SmartFare, clicca <a href="${resetLink}" target="_blank">qui</a>.</p>
                        
                        <p>Se avevi già effettuato una richiesta di modifica della password, solo il link contenuto in questa email è valido.</p>
                        
                        <br>
                        <p class="bold">Se invece non eri tu:</p>
                        <p>Il tuo account SmartFare potrebbe essere stato compromesso e dovresti <a href="${resetLink}" target="_blank">ripristinare subito la password</a>. Se non hai ancora aggiunto la verifica in due passaggi al tuo account, ti consigliamo di attivarla subito per migliorare la sicurezza del tuo account e prevenire accessi non autorizzati.</p>
                        
                        <br><br>
                        <p>Cordialmente,</p>
                        <p>Il team SmartFare</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        try {
            const fromEmail = process.env.SMTP_USER 
                ? `"SmartFare Support" <${process.env.SMTP_USER}>` 
                : '"SmartFare Support" <support@smartfare.com>';

            const path = require('path');
            const logoPath = path.resolve(process.cwd(), 'assets', 'logo.png');
            // If SendGrid is configured, send via HTTP API instead of SMTP
            if (this.useSendgrid && this.sendgridApiKey) {
                const sgFrom = this.defaultFromEmail || 'support@smartfare.com';
                const payload = {
                    personalizations: [{ to: [{ email: to }] }],
                    from: { email: sgFrom, name: 'SmartFare Support' },
                    subject: 'Recupero Password Account - SmartFare Tickets',
                    content: [{ type: 'text/html', value: htmlTemplate }]
                };

                const resp = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
                    headers: {
                        Authorization: `Bearer ${this.sendgridApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log('Message sent via SendGrid, status:', resp.status);
                return;
            }

            const info = await this.transporter!.sendMail({
                from: fromEmail,
                to: to,
                subject: "Recupero Password Account - SmartFare Tickets",
                html: htmlTemplate,
                attachments: [
                    {
                        filename: 'logo.png',
                        path: logoPath,
                        cid: 'smartfarelogo' // Mappato all'img tag src="cid:smartfarelogo"
                    }
                ]
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


        const htmlTemplate = `
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verifica Email</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #333333;
                }
                .wrapper {
                    padding: 30px 15px;
                }
                .container {
                    background-color: #ffffff;
                    max-width: 600px;
                    margin: 0 auto;
                    border: 1px solid #e0e0e0;
                }
                .header {
                    padding: 20px 30px 15px;
                }
                .logo-text {
                    font-size: 28px;
                    font-weight: 900;
                    color: #000000;
                    margin: 0;
                    letter-spacing: -1px;
                    display: flex;
                    align-items: center;
                }
                .divider {
                    height: 5px;
                    background-color: #666666;
                    width: 100%;
                }
                .content {
                    padding: 40px 30px;
                    font-size: 15px;
                    line-height: 1.5;
                }
                .content p {
                    margin-bottom: 20px;
                    color: #333333;
                }
                .bold {
                    font-weight: bold;
                }
                a.button {
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #000000;
                    color: #ffffff;
                    text-decoration: none;
                    font-weight: bold;
                    border-radius: 4px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <div class="logo-text">
                            <img src="cid:smartfarelogo" alt="Logo" style="height: 36px; vertical-align: middle; margin-right: 12px; border: 0;" />
                            <span style="vertical-align: middle;">SMARTFARE</span>
                        </div>
                    </div>
                    <div class="divider"></div>
                    
                    <div class="content">
                        <p>Benvenuto su SmartFare!</p>
                        
                        <p>Grazie per esserti registrato. Per completare la registrazione e attivare il tuo account, clicca sul pulsante qui sotto per verificare il tuo indirizzo email.</p>
                        
                        <center>
                            <a href="${verificationLink}" class="button" target="_blank">Verifica Email</a>
                        </center>
                        
                        <p>Questo link scadrà tra 1 ora.</p>
                        <p>Se non hai creato un account SmartFare, puoi ignorare questa email in tutta sicurezza.</p>
                        
                        <br><br>
                        <p>Cordialmente,</p>
                        <p>Il team SmartFare</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        try {
            const fromEmail = process.env.SMTP_USER 
                ? `"SmartFare Support" <${process.env.SMTP_USER}>` 
                : '"SmartFare Support" <support@smartfare.com>';

            const path = require('path');
            const logoPath = path.resolve(process.cwd(), 'assets', 'logo.png');
            // Send via SendGrid if configured
            if (this.useSendgrid && this.sendgridApiKey) {
                const sgFrom = this.defaultFromEmail || 'support@smartfare.com';
                const payload = {
                    personalizations: [{ to: [{ email: to }] }],
                    from: { email: sgFrom, name: 'SmartFare Support' },
                    subject: 'Verifica il tuo indirizzo email - SmartFare Tickets',
                    content: [{ type: 'text/html', value: htmlTemplate }]
                };

                const resp = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
                    headers: {
                        Authorization: `Bearer ${this.sendgridApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log('Message sent via SendGrid, status:', resp.status);
                return;
            }

            const info = await this.transporter!.sendMail({
                from: fromEmail,
                to: to,
                subject: "Verifica il tuo indirizzo email - SmartFare Tickets",
                html: htmlTemplate,
                attachments: [
                    {
                        filename: 'logo.png',
                        path: logoPath,
                        cid: 'smartfarelogo'
                    }
                ]
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
