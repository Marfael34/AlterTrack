import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailingService } from '../mailing/mailing.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import {
  CALL_FOLLOW_UP_DELAY_DAYS,
  callFollowUpThreshold,
} from './follow-up.constants';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailingService: MailingService,
    private readonly pushService: PushNotificationService,
  ) {}

  /**
   * Cron quotidien à 09:00.
   * Exécute les transitions de la machine à états (envoi auto, passage à « À appeler »).
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
   * Critère « À appeler » : premier mail envoyé, sans réponse, et dernier contact
   * (premier mail ou relance manuelle) vieux d'au moins CALL_FOLLOW_UP_DELAY_DAYS jours.
   *
   * TO_FOLLOW_UP sans relance envoyée est inclus pour reprendre les entreprises
   * laissées dans cet état par l'ancien cycle (relance e-mail automatique à J+8,
   * supprimée) : elles sont recalculées avec le nouveau délai.
   */
  private buildCallDueWhere(now: Date): Prisma.CompanyWhereInput {
    const threshold = callFollowUpThreshold(now);
    return {
      firstMailSentAt: { not: null, lte: threshold },
      OR: [
        {
          status: Status.WAITING_FOR_REPLY,
          OR: [
            { followUpSentAt: null },
            { followUpSentAt: { lte: threshold } },
          ],
        },
        { status: Status.TO_FOLLOW_UP, followUpSentAt: null },
      ],
    };
  }

  /**
   * Exécute les étapes de la machine à états séquentiellement :
   * 0. Envoi automatique des candidatures au statut AUTO_SEND
   * 1. Passage à « À appeler » après CALL_FOLLOW_UP_DELAY_DAYS jours sans réponse
   */
  async runStateMachineTransitions() {
    const now = new Date();

    const result = {
      autoSentBatchCount: 0,
      transitionedToCall: 0,
    };

    // -------------------------------------------------------------------------
    // 0. Envoi automatique quotidien : Candidatures au statut AUTO_SEND
    // -------------------------------------------------------------------------
    const autoSendCompanies = await this.prisma.company.findMany({
      where: {
        status: Status.AUTO_SEND,
      },
    });

    if (autoSendCompanies.length > 0) {
      this.logger.log(
        `09:00 - Envoi automatique pour ${autoSendCompanies.length} entreprise(s) au statut Envoi automatique`,
      );
      try {
        const batchResult = await this.mailingService.sendInitialBatch();
        result.autoSentBatchCount = batchResult.successCount;
      } catch (err) {
        this.logger.error(
          `Échec de l'envoi groupé automatique : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // -------------------------------------------------------------------------
    // 1. Passage à « À appeler » : dernier contact échu, toujours sans réponse
    // -------------------------------------------------------------------------
    const companiesToCall = await this.prisma.company.findMany({
      where: this.buildCallDueWhere(now),
      select: { id: true, name: true },
    });

    if (companiesToCall.length > 0) {
      this.logger.log(
        `J+${CALL_FOLLOW_UP_DELAY_DAYS} : ${companiesToCall.length} entreprise(s) passent au statut À appeler`,
      );

      for (const comp of companiesToCall) {
        await this.prisma.company.update({
          where: { id: comp.id },
          data: { status: Status.TO_CALL },
        });

        await this.pushService.sendPushNotification({
          title: 'Candidature à appeler',
          body: `${CALL_FOLLOW_UP_DELAY_DAYS} jours sans réponse pour ${comp.name}. Un appel téléphonique est recommandé.`,
          data: { companyId: comp.id, status: Status.TO_CALL },
        });

        result.transitionedToCall++;
      }
    }

    this.logger.log(
      `--- Fin du cycle quotidien : AUTO_SEND=${result.autoSentBatchCount}, À appeler (J+${CALL_FOLLOW_UP_DELAY_DAYS})=${result.transitionedToCall} ---`,
    );

    return result;
  }

  async getSchedulerOverview() {
    const now = new Date();

    const [autoSendPending, toCallPending] = await Promise.all([
      this.prisma.company.count({
        where: {
          status: Status.AUTO_SEND,
        },
      }),
      this.prisma.company.count({
        where: this.buildCallDueWhere(now),
      }),
    ]);

    return {
      status: 'active',
      crons: {
        dailyStateMachine:
          'Tous les jours à 09:00 (CronExpression.EVERY_DAY_AT_9AM)',
        periodicImapCheck: 'Toutes les 10 minutes (*/10 * * * *)',
      },
      callFollowUpDelayDays: CALL_FOLLOW_UP_DELAY_DAYS,
      readyForTransition: {
        autoSendPending,
        toCallPending,
      },
      currentTime: now.toISOString(),
    };
  }
}
