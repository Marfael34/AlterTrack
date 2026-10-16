import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
  attachmentName?: string;
  senderUser?: string | null;
  senderPass?: string | null;
  senderName?: string | null;
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
      this.logger.log(`Transport SMTP Gmail global configuré pour ${user}`);
    } else {
      this.logger.warn(
        'Identifiants Gmail SMTP globaux non configurés : les envois sans identifiants utilisateur seront simulés.',
      );
    }
  }

  isConfigured(
    userCustomGmail?: string | null,
    userCustomPass?: string | null,
  ): { configured: boolean; user: string | null } {
    if (userCustomGmail && userCustomPass) {
      return {
        configured: true,
        user: userCustomGmail,
      };
    }
    return {
      configured: Boolean(this.transporter && this.fromUser),
      user: this.fromUser,
    };
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    const effectiveUser = options.senderUser || this.fromUser;
    const effectiveName = options.senderName || 'Rafael Martinez';

    let activeTransporter = this.transporter;

    if (options.senderUser && options.senderPass) {
      activeTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: options.senderUser, pass: options.senderPass },
      });
    }

    if (!activeTransporter || !effectiveUser) {
      const mockId = `<mock-${Date.now()}@altertrack.local>`;
      this.logger.log(
        `[SIMULATION ENVOI MAIL] De: ${effectiveUser ?? 'Non configuré'} | Vers: ${options.to} | Objet: "${options.subject}" | ID: ${mockId}`,
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
      from: `"${effectiveName}" <${effectiveUser}>`,
      to: options.to,
      subject: options.subject,
      text: options.body,
      attachments,
    };

    try {
      const info = await activeTransporter.sendMail(mailOptions);
      this.logger.log(
        `Email envoyé avec succès de ${effectiveUser} à ${options.to} (ID: ${info.messageId})`,
      );
      return { messageId: info.messageId };
    } catch (err: any) {
      this.logger.error(
        `Erreur SMTP lors de l'envoi vers ${options.to}: ${err?.message}`,
      );
      if (
        err?.message?.includes('535') ||
        err?.message?.toLowerCase().includes('badcredentials') ||
        err?.message?.toLowerCase().includes('invalid login')
      ) {
        throw new BadRequestException(
          `Échec d'authentification Gmail (535) : Google a rejeté vos identifiants pour "${effectiveUser}". Assurez-vous d'utiliser un Mot de passe d'application Google (16 lettres sans espace) généré sur https://myaccount.google.com/apppasswords.`,
        );
      }
      throw new BadRequestException(
        `Erreur lors de l'envoi de l'e-mail : ${err?.message || 'Erreur SMTP'}`,
      );
    }
  }
}

