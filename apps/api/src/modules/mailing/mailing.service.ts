import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Status } from '@prisma/client';
import * as fs from 'fs';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService, buildStandardCvFileName } from '../app-config/app-config.service';
import { EmailNature } from '../gemini/dto/generate-email.dto';
import { GeminiService } from '../gemini/gemini.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { EmailService } from './email.service';
import { ImapService } from './imap.service';

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.fr',
  'outlook.com',
  'outlook.fr',
  'hotmail.com',
  'hotmail.fr',
  'live.com',
  'live.fr',
  'free.fr',
  'orange.fr',
  'wanadoo.fr',
  'sfr.fr',
  'laposte.net',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
]);

@Injectable()
export class MailingService {
  private readonly logger = new Logger(MailingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly emailService: EmailService,
    private readonly imapService: ImapService,
    private readonly appConfigService: AppConfigService,
    private readonly pushService: PushNotificationService,
  ) {}

  private async resolveCvAttachment(
    currentUser?: {
      cvFilePath?: string | null;
      cvOriginalName?: string | null;
      fullName?: string | null;
    } | null,
    config?: {
      cvFilePath?: string | null;
      cvOriginalName?: string | null;
    } | null,
  ): Promise<{ path?: string; name: string }> {
    let cvPath: string | undefined;
    let cvName = 'CV.pdf';

    if (currentUser?.cvFilePath && fs.existsSync(currentUser.cvFilePath)) {
      cvPath = currentUser.cvFilePath;
      cvName =
        currentUser.cvOriginalName ||
        (currentUser.fullName
          ? buildStandardCvFileName(currentUser.fullName)
          : 'CV.pdf');
    } else {
      try {
        cvPath = await this.appConfigService.getCvFilePath();
        cvName =
          config?.cvOriginalName ||
          (currentUser?.fullName
            ? buildStandardCvFileName(currentUser.fullName)
            : 'CV.pdf');
      } catch {
        this.logger.warn(
          'Aucun CV PDF trouvé sur le serveur pour la pièce jointe.',
        );
      }
    }

    return { path: cvPath, name: cvName };
  }

  async sendInitialBatch(companyIds?: string[], userId?: string) {
    let currentUser: any = null;
    if (userId) {
      currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });
    }

    const config = await this.appConfigService.getOrCreateConfig();

    const whereClause: any = {
      status: Status.TO_SEND,
      ...(userId ? { userId } : {}),
    };

    if (companyIds && companyIds.length > 0) {
      whereClause.id = { in: companyIds };
    }

    const companies = await this.prisma.company.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    });

    this.logger.log(
      `Démarrage de l'envoi groupé pour ${companies.length} entreprise(s) au statut À envoyer`,
    );

    const successful: string[] = [];
    const failed: { id: string; name: string; error: string }[] = [];

    const { path: cvPath, name: cvName } = await this.resolveCvAttachment(
      currentUser,
      config,
    );

    const template = currentUser?.template || config.template;

    for (const company of companies) {
      try {
        const emailContent = await this.geminiService.generateEmail({
          companyName: company.name,
          template,
          nature: EmailNature.FIRST_CONTACT,
        });

        const sendResult = await this.emailService.sendMail({
          to: company.email,
          subject: emailContent.subject,
          body: emailContent.body,
          attachmentPath: cvPath,
          attachmentName: cvName,
          senderUser: currentUser?.gmailUser,
          senderPass: currentUser?.gmailAppPassword,
          senderName: currentUser?.fullName,
        });

        const now = new Date();
        const followUpTargetDate = new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000,
        );

        await this.prisma.company.update({
          where: { id: company.id },
          data: {
            status: Status.WAITING_FOR_REPLY,
            firstMailSentAt: now,
            followUpReadyAt: followUpTargetDate,
            lastMailId: sendResult.messageId,
          },
        });

        successful.push(company.id);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Échec d'envoi pour ${company.name} (${company.email}): ${errorMsg}`,
        );
        failed.push({
          id: company.id,
          name: company.name,
          error: errorMsg,
        });
      }
    }

    return {
      totalFound: companies.length,
      successCount: successful.length,
      failedCount: failed.length,
      successfulIds: successful,
      failed,
      cvAttached: !!cvPath,
      cvName: cvName || null,
    };
  }

  async sendSingle(
    companyId: string,
    customSubject?: string,
    customBody?: string,
    userId?: string,
  ) {
    const where: any = { id: companyId };
    if (userId) {
      where.userId = userId;
    }

    const company = await this.prisma.company.findFirst({
      where,
    });

    if (!company) {
      throw new NotFoundException(
        `Entreprise avec l'ID ${companyId} non trouvée`,
      );
    }

    let currentUser: any = null;
    const effectiveUserId = userId || company.userId;
    if (effectiveUserId) {
      currentUser = await this.prisma.user.findUnique({
        where: { id: effectiveUserId },
      });
    }

    const config = await this.appConfigService.getOrCreateConfig();

    const { path: cvPath, name: cvName } = await this.resolveCvAttachment(
      currentUser,
      config,
    );

    const template = currentUser?.template || config.template;
    let subject = customSubject?.trim();
    let body = customBody?.trim();

    if (!subject || !body) {
      const emailContent = await this.geminiService.generateEmail({
        companyName: company.name,
        template,
        nature: EmailNature.FIRST_CONTACT,
      });
      subject = subject || emailContent.subject;
      body = body || emailContent.body;
    }

    const sendResult = await this.emailService.sendMail({
      to: company.email,
      subject,
      body,
      attachmentPath: cvPath,
      attachmentName: cvName,
      senderUser: currentUser?.gmailUser,
      senderPass: currentUser?.gmailAppPassword,
      senderName: currentUser?.fullName,
    });

    const now = new Date();
    const followUpTargetDate = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        status: Status.WAITING_FOR_REPLY,
        firstMailSentAt: now,
        followUpReadyAt: followUpTargetDate,
        lastMailId: sendResult.messageId,
      },
    });

    return {
      success: true,
      company: updated,
      messageId: sendResult.messageId,
      isSimulation: Boolean(sendResult.isSimulation),
      hasAttachment: Boolean(sendResult.hasAttachment),
      attachmentName: sendResult.attachmentName || null,
    };
  }

  async sendFollowUp(companyId: string, userId?: string) {
    const where: any = { id: companyId };
    if (userId) {
      where.userId = userId;
    }

    const company = await this.prisma.company.findFirst({
      where,
    });

    if (!company) {
      throw new NotFoundException(
        `Entreprise avec l'ID ${companyId} non trouvée`,
      );
    }

    // Règle anti-spam critique : 1 seule relance autorisée
    if (company.followUpSentAt) {
      throw new BadRequestException(
        `Une relance a déjà été envoyée à cette entreprise le ${company.followUpSentAt.toISOString()}`,
      );
    }

    let currentUser: any = null;
    const effectiveUserId = userId || company.userId;
    if (effectiveUserId) {
      currentUser = await this.prisma.user.findUnique({
        where: { id: effectiveUserId },
      });
    }

    const config = await this.appConfigService.getOrCreateConfig();

    const { path: cvPath, name: cvName } = await this.resolveCvAttachment(
      currentUser,
      config,
    );

    const template = currentUser?.template || config.template;

    const emailContent = await this.geminiService.generateEmail({
      companyName: company.name,
      template,
      nature: EmailNature.FOLLOW_UP,
    });

    const sendResult = await this.emailService.sendMail({
      to: company.email,
      subject: emailContent.subject,
      body: emailContent.body,
      attachmentPath: cvPath,
      attachmentName: cvName,
      senderUser: currentUser?.gmailUser,
      senderPass: currentUser?.gmailAppPassword,
      senderName: currentUser?.fullName,
    });

    const now = new Date();

    return this.prisma.company.update({
      where: { id: company.id },
      data: {
        status: Status.WAITING_FOR_REPLY,
        followUpSentAt: now,
        lastMailId: sendResult.messageId,
      },
    });
  }

  async checkIncomingReplies() {
    this.logger.log(
      'Lancement de la vérification des réponses entrantes via IMAP...',
    );

    const incomingEmails = await this.imapService.fetchRecentIncomingEmails();
    if (incomingEmails.length === 0) {
      return {
        messagesScanned: 0,
        repliesDetected: 0,
        matchedCompanies: [],
      };
    }

    const activeCompanies = await this.prisma.company.findMany({
      where: {
        status: {
          in: [Status.WAITING_FOR_REPLY, Status.TO_FOLLOW_UP, Status.TO_CALL],
        },
      },
    });

    const matchedCompanies: {
      companyId: string;
      companyName: string;
      matchedEmail: string;
    }[] = [];

    for (const email of incomingEmails) {
      const fromAddr = email.fromAddress;
      const fromDomain = email.fromDomain;

      for (const comp of activeCompanies) {
        const compEmail = comp.email.toLowerCase();
        const compDomainParts = compEmail.split('@');
        const compDomain = compDomainParts.length > 1 ? compDomainParts[1] : '';

        const isExactMatch = compEmail === fromAddr;
        const isDomainMatch =
          !GENERIC_EMAIL_DOMAINS.has(fromDomain) &&
          fromDomain.length > 3 &&
          fromDomain === compDomain;

        if (isExactMatch || isDomainMatch) {
          this.logger.log(
            `Réponse détectée de ${fromAddr} pour l'entreprise ${comp.name} (Statut -> REPLY_RECEIVED)`,
          );

          await this.prisma.company.update({
            where: { id: comp.id },
            data: {
              status: Status.REPLY_RECEIVED,
            },
          });

          await this.pushService.sendPushNotification({
            title: 'Nouvelle réponse reçue !',
            body: `Nouvelle réponse reçue de ${comp.name} !`,
            data: { companyId: comp.id, status: Status.REPLY_RECEIVED },
          });

          matchedCompanies.push({
            companyId: comp.id,
            companyName: comp.name,
            matchedEmail: fromAddr,
          });
        }
      }
    }

    return {
      messagesScanned: incomingEmails.length,
      repliesDetected: matchedCompanies.length,
      matchedCompanies,
    };
  }

  async testGemini(companyName: string, nature?: EmailNature, userId?: string) {
    let template: string | undefined;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.template) template = user.template;
    }

    if (!template) {
      const config = await this.appConfigService.getOrCreateConfig();
      template = config.template;
    }

    return this.geminiService.generateEmail({
      companyName,
      template,
      nature: nature || EmailNature.FIRST_CONTACT,
    });
  }

  async sendTestEmail(
    toEmail: string,
    companyName?: string,
    customSubject?: string,
    customBody?: string,
    currentUser?: {
      id?: string;
      fullName?: string;
      gmailUser?: string | null;
      gmailAppPassword?: string | null;
      template?: string | null;
      cvFilePath?: string | null;
      cvOriginalName?: string | null;
    },
  ) {
    const targetCompany = companyName?.trim() || 'Entreprise Exemple';
    const config = await this.appConfigService.getOrCreateConfig();

    const { path: cvPath, name: cvName } = await this.resolveCvAttachment(
      currentUser,
      config,
    );

    let subject = customSubject?.trim();
    let body = customBody?.trim();

    if (!subject || !body) {
      const template = currentUser?.template || config.template;
      const emailContent = await this.geminiService.generateEmail({
        companyName: targetCompany,
        template,
        nature: EmailNature.FIRST_CONTACT,
      });
      subject = subject || emailContent.subject;
      body = body || emailContent.body;
    }

    const isSmtp = this.emailService.isConfigured(
      currentUser?.gmailUser,
      currentUser?.gmailAppPassword,
    );

    const sendResult = await this.emailService.sendMail({
      to: toEmail.trim(),
      subject,
      body,
      attachmentPath: cvPath,
      attachmentName: cvName,
      senderUser: currentUser?.gmailUser,
      senderPass: currentUser?.gmailAppPassword,
      senderName: currentUser?.fullName,
    });

    return {
      success: true,
      recipient: toEmail.trim(),
      companyTarget: targetCompany,
      subject,
      body,
      hasAttachment: Boolean(sendResult.hasAttachment),
      attachmentName: sendResult.attachmentName || (cvPath ? cvName : null),
      messageId: sendResult.messageId,
      isSimulation: !isSmtp.configured,
      smtpUser: isSmtp.user,
      note: !isSmtp.configured
        ? 'Identifiants Gmail non configurés (ni dans votre profil ni sur le serveur) : l’envoi a été simulé dans les journaux.'
        : `E-mail envoyé avec succès à ${toEmail.trim()} depuis l’adresse ${isSmtp.user} (avec CV joint).`,
    };
  }
}

