import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
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

  async sendInitialBatch(companyIds?: string[]) {
    const config = await this.appConfigService.getOrCreateConfig();

    const whereClause: { status: Status; id?: { in: string[] } } = {
      status: Status.TO_SEND,
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

    let cvPath: string | undefined;
    try {
      cvPath = await this.appConfigService.getCvFilePath();
    } catch {
      this.logger.warn(
        'Aucun CV PDF trouvé sur le serveur pour la pièce jointe.',
      );
    }

    for (const company of companies) {
      try {
        const emailContent = await this.geminiService.generateEmail({
          companyName: company.name,
          template: config.template,
          nature: EmailNature.FIRST_CONTACT,
        });

        const sendResult = await this.emailService.sendMail({
          to: company.email,
          subject: emailContent.subject,
          body: emailContent.body,
          attachmentPath: cvPath,
          attachmentName: config.cvOriginalName || 'CV.pdf',
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
    };
  }

  async sendFollowUp(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
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

    const config = await this.appConfigService.getOrCreateConfig();

    let cvPath: string | undefined;
    try {
      cvPath = await this.appConfigService.getCvFilePath();
    } catch {
      this.logger.warn('Aucun CV PDF trouvé pour la relance.');
    }

    const emailContent = await this.geminiService.generateEmail({
      companyName: company.name,
      template: config.template,
      nature: EmailNature.FOLLOW_UP,
    });

    const sendResult = await this.emailService.sendMail({
      to: company.email,
      subject: emailContent.subject,
      body: emailContent.body,
      attachmentPath: cvPath,
      attachmentName: config.cvOriginalName || 'CV.pdf',
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

  async testGemini(companyName: string, nature?: EmailNature) {
    const config = await this.appConfigService.getOrCreateConfig();

    return this.geminiService.generateEmail({
      companyName,
      template: config.template,
      nature: nature || EmailNature.FIRST_CONTACT,
    });
  }

  async sendTestEmail(toEmail: string, companyName?: string) {
    const targetCompany = companyName?.trim() || 'Entreprise Exemple (Test)';
    const config = await this.appConfigService.getOrCreateConfig();

    let cvPath: string | undefined;
    try {
      cvPath = await this.appConfigService.getCvFilePath();
    } catch {
      this.logger.warn(
        'Aucun CV PDF trouvé sur le serveur pour la pièce jointe du test.',
      );
    }

    const emailContent = await this.geminiService.generateEmail({
      companyName: targetCompany,
      template: config.template,
      nature: EmailNature.FIRST_CONTACT,
    });

    const isSmtp = this.emailService.isConfigured();

    const sendResult = await this.emailService.sendMail({
      to: toEmail.trim(),
      subject: `[TEST ALTERTRACK] ${emailContent.subject}`,
      body: `=== CE MESSAGE EST UN TEST ALTERTRACK ===\nEntreprise ciblée pour la génération : ${targetCompany}\nDestinataire réel lors d'une vraie candidature : rh@${targetCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.com\n==========================================\n\n${emailContent.body}`,
      attachmentPath: cvPath,
      attachmentName: config.cvOriginalName || 'CV.pdf',
    });

    return {
      success: true,
      recipient: toEmail.trim(),
      companyTarget: targetCompany,
      subject: `[TEST ALTERTRACK] ${emailContent.subject}`,
      body: emailContent.body,
      hasAttachment: Boolean(cvPath),
      attachmentName: cvPath ? config.cvOriginalName || 'CV.pdf' : null,
      messageId: sendResult.messageId,
      isSimulation: !isSmtp.configured,
      smtpUser: isSmtp.user,
      note: !isSmtp.configured
        ? 'Identifiants Gmail SMTP non configurés dans le fichier .env : l’envoi a été simulé dans les journaux du serveur.'
        : 'E-mail de test réel expédié avec succès via smtp.gmail.com avec votre CV joint.',
    };
  }
}
