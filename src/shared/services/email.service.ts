import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(EmailService.name);

    constructor(private configService: ConfigService) {
        const smtpUser = this.configService.get('SMTP_USER');
        const smtpPass = this.configService.get('SMTP_PASS');

        if (smtpUser && smtpPass) {
            this.transporter = nodemailer.createTransport({
                host: this.configService.get('SMTP_HOST') || 'smtp.gmail.com',
                port: Number(this.configService.get('SMTP_PORT')) || 587,
                secure: Number(this.configService.get('SMTP_PORT')) === 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
                connectionTimeout: 4000,
                greetingTimeout: 4000,
                socketTimeout: 4000,
            });
        }
    }

    /** True when SMTP is set up (or, outside production, emails are saved to tmp/mail instead). */
    canSend(): boolean {
        return !!this.transporter || process.env.NODE_ENV !== 'production';
    }

    /**
     * Send an email and wait for the result. Throws when it can't be sent, so the caller can tell the user.
     * Without SMTP outside production the email is written to tmp/mail/ so it can be checked locally.
     */
    async send(mail: { to: string; subject: string; html: string; text?: string; fromName?: string; replyTo?: string }): Promise<{ messageId?: string; savedTo?: string }> {
        const from = `"${(mail.fromName ?? 'Auvren Till').replace(/["\r\n]/g, '')}" <${this.configService.get('SMTP_USER')}>`;
        if (!this.transporter) {
            if (process.env.NODE_ENV === 'production') throw new Error('Email is not set up on the server');
            const dir = join(process.cwd(), 'tmp', 'mail');
            await mkdir(dir, { recursive: true });
            const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.html`);
            await writeFile(file, `<!-- To: ${mail.to} | Subject: ${mail.subject} -->\n${mail.html}`);
            this.logger.warn(`SMTP not configured: saved email to ${mail.to} as ${file}`);
            return { savedTo: file };
        }
        const info = await this.transporter.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo || undefined });
        return { messageId: info.messageId };
    }

    /**
     * Send password reset email with temporary password
     */
    async sendPasswordResetEmail(
        to: string,
        userName: string,
        temporaryPassword: string,
    ): Promise<void> {
        if (!this.transporter) {
            this.logger.warn(`SMTP credentials not configured (SMTP_USER/SMTP_PASS missing) — skipping password reset email to ${to}`);
            return;
        }

        const mailOptions = {
            from: `"RestFlow Support" <${this.configService.get('SMTP_USER')}>`,
            to,
            subject: 'Password Reset - RestFlow',
            html: this.getPasswordResetEmailTemplate(userName, temporaryPassword),
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`Password reset email sent to ${to}: ${info.messageId}`);
        } catch (error) {
            this.logger.error(`Failed to send password reset email to ${to}: ${error.message}`);
        }
    }

    /**
     * HTML template for password reset email
     */
    private getPasswordResetEmailTemplate(
        userName: string,
        temporaryPassword: string,
    ): string {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .password-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 6px; padding: 15px; text-align: center; font-size: 18px; font-weight: bold; color: #1e293b; margin: 20px 0; }
          .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; font-size: 14px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">RestFlow</div>
              <h2>Password Reset Request</h2>
            </div>
            
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>You recently requested to reset your password for your RestFlow account. Here is your temporary password:</p>
            
            <div class="password-box">
              ${temporaryPassword}
            </div>
            
            <div class="warning">
              <strong>⚠️ Important Security Notice:</strong>
              <ul>
                <li>This is a temporary password</li>
                <li>Please change it immediately after logging in</li>
                <li>Do not share this password with anyone</li>
                <li>This email should be deleted after use</li>
              </ul>
            </div>
            
            <p><strong>How to use your temporary password:</strong></p>
            <ol>
              <li>Go to the RestFlow login page</li>
              <li>Enter your email address</li>
              <li>Use the temporary password above</li>
              <li>You will be prompted to change your password</li>
            </ol>
            
            <p>If you did not request this password reset, please contact your administrator immediately.</p>
            
            <div class="footer">
              <p>This is an automated message from RestFlow. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} RestFlow. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    }

    /**
     * Send test email to verify configuration
     */
    async sendTestEmail(to: string): Promise<void> {
        const mailOptions = {
            from: `"RestFlow Support" <${this.configService.get('SMTP_USER')}>`,
            to,
            subject: 'Test Email - RestFlow',
            html: '<h1>Test Email</h1><p>If you received this, your email configuration is working correctly!</p>',
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`Test email sent to ${to}: ${info.messageId}`);
        } catch (error) {
            this.logger.error(`Failed to send test email to ${to}:`, error);
            throw new Error('Failed to send test email');
        }
    }
}
