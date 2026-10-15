import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
  attachmentName?: string;
}

export interface SendMailResult {
  messageId: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromUser: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('gmailUser');
    const pass = this.configService.get<string>('gmailAppPassword');

    if (user && pass && user !== 'mon.adresse@gmail.com') {
      this.fromUser = user;
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
      });
      this.logger.log(`Transport SMTP Gmail configuré pour ${user}`);
    } else {
      this.logger.warn(
        'Identifiants Gmail SMTP non configurés ou fictifs : mode simulation activé.',
      );
    }
  }

  isConfigured(): { configured: boolean; user: string | null } {
    return {
      configured: Boolean(this.transporter && this.fromUser),
      user: this.fromUser,
    };
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    if (!this.transporter || !this.fromUser) {
      const mockId = `<mock-${Date.now()}@altertrack.local>`;
      this.logger.log(
        `[SIMULATION ENVOI MAIL] Vers: ${options.to} | Objet: "${options.subject}" | ID: ${mockId}`,
      );
      return { messageId: mockId };
    }

    const attachments: nodemailer.SendMailOptions['attachments'] = [];

    if (options.attachmentPath && fs.existsSync(options.attachmentPath)) {
      attachments.push({
        filename: options.attachmentName || 'CV.pdf',
        path: options.attachmentPath,
        contentType: 'application/pdf',
      });
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"Rafael Martinez" <${this.fromUser}>`,
      to: options.to,
      subject: options.subject,
      text: options.body,
      attachments,
    };

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(
      `Email envoyé avec succès à ${options.to} (ID: ${info.messageId})`,
    );

    return { messageId: info.messageId };
  }
}
