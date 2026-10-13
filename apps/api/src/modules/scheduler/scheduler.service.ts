import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailingService } from '../mailing/mailing.service';
import { PushNotificationService } from '../notifications/push-notification.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailingService: MailingService,
    private readonly pushService: PushNotificationService,
  ) {}

  /**
   * Cron quotidien à 09:00 (jours ouvrés / tous les jours)
   * Exécute les transitions de la machine à états (J+7, J+8, J+15).
   * L'utilisation d'opérateurs <= garantit le rattrapage automatique si le serveur était éteint.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyStateMachine() {
    this.logger.log(
      '--- Début du Cron quotidien de suivi des candidatures (09:00) ---',
    );
    return this.runStateMachineTransitions();
  }

  /**
   * Cron exécuté toutes les 10 minutes.
   * Vérifie la boîte de réception Gmail via IMAP pour détecter les réponses entrantes.
   */
  @Cron('*/10 * * * *')
  async handlePeriodicImapCheck() {
    this.logger.log('--- Exécution du Cron IMAP (toutes les 10 min) ---');
    try {
      const result = await this.mailingService.checkIncomingReplies();
      if (result.repliesDetected > 0) {
        this.logger.log(
          `IMAP: ${result.repliesDetected} nouvelle(s) réponse(s) détectée(s) et mise(s) à jour !`,
        );
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors du Cron IMAP périodique : ${error instanceof Error ? error.message : String(error)}`,
      );
      return { error: String(error) };
    }
  }

  /**
   * Exécute les 3 étapes de la machine à états séquentiellement :
   * 1. Transition J+7 : WAITING_FOR_REPLY -> TO_FOLLOW_UP
   * 2. Envoi auto J+8 : TO_FOLLOW_UP -> relance envoyée (WAITING_FOR_REPLY)
   * 3. Transition J+15 : WAITING_FOR_REPLY (avec relance) -> TO_CALL
   */
  async runStateMachineTransitions() {
    const now = new Date();

    const result = {
      transitionedToFollowUpJ7: 0,
      followUpsSentJ8: 0,
      transitionedToCallJ15: 0,
    };

    // -------------------------------------------------------------------------
    // 1. Transition J+7 : Premier contact envoyé depuis >= 7 jours sans relance
    // -------------------------------------------------------------------------
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const companiesToFollowUp = await this.prisma.company.findMany({
      where: {
        status: Status.WAITING_FOR_REPLY,
        followUpSentAt: null, // Pas encore relancé
        firstMailSentAt: {
          lte: sevenDaysAgo, // Envoyé il y a 7 jours ou plus (rattrapage si PC éteint)
        },
      },
    });

    if (companiesToFollowUp.length > 0) {
      this.logger.log(
        `J+7 : ${companiesToFollowUp.length} entreprise(s) passent au statut À relancer`,
      );

      for (const comp of companiesToFollowUp) {
        await this.prisma.company.update({
          where: { id: comp.id },
          data: { status: Status.TO_FOLLOW_UP },
        });
        result.transitionedToFollowUpJ7++;
      }
    }

    // -------------------------------------------------------------------------
    // 2. Envoi J+8 : Entreprises au statut TO_FOLLOW_UP depuis >= 24h (ou J+8)
    // -------------------------------------------------------------------------
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const companiesReadyForRelance = await this.prisma.company.findMany({
      where: {
        status: Status.TO_FOLLOW_UP,
        followUpSentAt: null,
        firstMailSentAt: {
          lte: eightDaysAgo, // Au moins 8 jours après le 1er envoi (tampon de 24h respecté)
        },
      },
    });

    if (companiesReadyForRelance.length > 0) {
      this.logger.log(
        `J+8 : Envoi automatique de la relance pour ${companiesReadyForRelance.length} entreprise(s)`,
      );

      for (const comp of companiesReadyForRelance) {
        try {
          await this.mailingService.sendFollowUp(comp.id);
          result.followUpsSentJ8++;
          this.logger.log(`Relance J+8 expédiée avec succès pour ${comp.name}`);
        } catch (err) {
          this.logger.error(
            `Échec de la relance J+8 pour ${comp.name} : ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. Transition J+15 : Relance envoyée depuis >= 7 jours sans réponse (+7j après J+8)
    // -------------------------------------------------------------------------
    const sevenDaysAfterFollowUp = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    );

    const companiesToCall = await this.prisma.company.findMany({
      where: {
        status: Status.WAITING_FOR_REPLY,
        followUpSentAt: {
          not: null,
          lte: sevenDaysAfterFollowUp, // 7 jours ou plus depuis la relance
        },
      },
    });

    if (companiesToCall.length > 0) {
      this.logger.log(
        `J+15 : ${companiesToCall.length} entreprise(s) passent au statut À appeler`,
      );

      for (const comp of companiesToCall) {
        await this.prisma.company.update({
          where: { id: comp.id },
          data: { status: Status.TO_CALL },
        });

        await this.pushService.sendPushNotification({
          title: 'Candidature à appeler',
          body: `7 jours sans réponse après relance pour ${comp.name}. Un appel téléphonique est recommandé.`,
          data: { companyId: comp.id, status: Status.TO_CALL },
        });

        result.transitionedToCallJ15++;
      }
    }

    this.logger.log(
      `--- Fin du cycle quotidien : J+7=${result.transitionedToFollowUpJ7}, J+8=${result.followUpsSentJ8}, J+15=${result.transitionedToCallJ15} ---`,
    );

    return result;
  }

  async getSchedulerOverview() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const [j7Pending, j8Pending, j15Pending] = await Promise.all([
      this.prisma.company.count({
        where: {
          status: Status.WAITING_FOR_REPLY,
          followUpSentAt: null,
          firstMailSentAt: { lte: sevenDaysAgo },
        },
      }),
      this.prisma.company.count({
        where: {
          status: Status.TO_FOLLOW_UP,
          followUpSentAt: null,
          firstMailSentAt: { lte: eightDaysAgo },
        },
      }),
      this.prisma.company.count({
        where: {
          status: Status.WAITING_FOR_REPLY,
          followUpSentAt: { not: null, lte: sevenDaysAgo },
        },
      }),
    ]);

    return {
      status: 'active',
      crons: {
        dailyStateMachine:
          'Tous les jours à 09:00 (CronExpression.EVERY_DAY_AT_9AM)',
        periodicImapCheck: 'Toutes les 10 minutes (*/10 * * * *)',
      },
      readyForTransition: {
        j7ToFollowUp: j7Pending,
        j8AutoRelance: j8Pending,
        j15ToCall: j15Pending,
      },
      currentTime: now.toISOString(),
    };
  }
}
