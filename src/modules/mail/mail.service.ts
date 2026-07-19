import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly mailFrom: string;
  private readonly siteName: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);

    this.mailFrom = this.configService.get<string>('MAIL_FROM', 'Rental Admin <no-reply@rental.local>');
    // this.siteName = this.configService.get<string>('MAIL_SITE_NAME', 'Rental Admin');
    this.siteName = 'Rental Admin';
    this.transporter = host && user && pass ? createTransport({ host, port, secure, auth: { user, pass } }) : null;
  }



  async sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP is not configured');
    }

    await this.transporter.sendMail({
      from: this.mailFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }

  buildPasswordResetEmailHtml(resetUrl: string, user?: { fullName?: string | null }): string {
    const safeSiteName = this.escapeHtml(this.siteName);
    const safeResetUrl = this.escapeHtml(resetUrl);
    const safeFullName = this.escapeHtml(user?.fullName || 'ban');
    const currentYear = new Date().getFullYear();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Dat lai mat khau</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f9fafb;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            padding: 32px;
            background-color: #ffffff;
            border-radius: 8px;
            border: 1px solid #e1e4e8;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          }
          .brand {
            margin-bottom: 24px;
          }
          .brand h2 {
            margin: 0;
            color: #111111;
            font-size: 20px;
            font-weight: 700;
          }
          h1 {
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 16px;
            color: #111111;
          }
          p {
            margin: 0 0 16px;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 24px 0;
            text-align: center;
          }
          .link-container {
            margin-top: 24px;
            font-size: 14px;
            color: #666666;
          }
          .link {
            color: #2563eb;
            text-decoration: none;
            word-break: break-all;
          }
          .footer {
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #e1e4e8;
            font-size: 12px;
            color: #888888;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand">
            <h2>${safeSiteName}</h2>
          </div>

          <h1>Dat lai mat khau</h1>

          <p>Xin chao <strong>${safeFullName}</strong>,</p>

          <p>Ban vua yeu cau dat lai mat khau cho tai khoan tai ${safeSiteName}.</p>
          <p>Vui long nhan vao nut ben duoi de tao mat khau moi. Link nay chi co hieu luc trong thoi gian ngan.</p>

          <a href="${safeResetUrl}" class="button">Dat lai mat khau</a>

          <div class="link-container">
            <p style="margin-bottom: 8px;">Hoac truy cap link sau neu nut tren khong hoat dong:</p>
            <a href="${safeResetUrl}" class="link">${safeResetUrl}</a>
          </div>

          <div class="footer">
            <p>Neu ban khong yeu cau thao tac nay, hay bo qua email nay.</p>
            <p>&copy; ${currentYear} ${safeSiteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}
