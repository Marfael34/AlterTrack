import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailingService } from '../mailing/mailing.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { CALL_FOLLOW_UP_DELAY_DAYS } from './follow-up.constants';
import { SchedulerService } from './scheduler.service';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let prisma: {
    company: {
      findMany: jest.Mock<Promise<unknown>, [Prisma.CompanyFindManyArgs]>;
      update: jest.Mock<Promise<unknown>, [Prisma.CompanyUpdateArgs]>;
      count: jest.Mock;
    };
  };
  let pushService: { sendPushNotification: jest.Mock };
  let mailingService: {
    sendFollowUp: jest.Mock;
    checkIncomingReplies: jest.Mock;
    sendInitialBatch: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      company: {
        findMany: jest
          .fn<Promise<unknown>, [Prisma.CompanyFindManyArgs]>()
          .mockResolvedValue([]),
        update: jest
          .fn<Promise<unknown>, [Prisma.CompanyUpdateArgs]>()
          .mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    mailingService = {
      sendFollowUp: jest.fn().mockResolvedValue({}),
      checkIncomingReplies: jest.fn().mockResolvedValue({
        messagesScanned: 5,
        repliesDetected: 1,
        matchedCompanies: [],
      }),
      sendInitialBatch: jest.fn().mockResolvedValue({
        totalFound: 1,
        successCount: 1,
        failedCount: 0,
      }),
    };

    pushService = { sendPushNotification: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailingService, useValue: mailingService },
        { provide: PushNotificationService, useValue: pushService },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runStateMachineTransitions', () => {
    it('should trigger sendInitialBatch for AUTO_SEND companies', async () => {
      const autoSendCompany = {
        id: 'comp-auto',
        name: 'Entreprise Auto',
        status: Status.AUTO_SEND,
      };

      prisma.company.findMany
        .mockResolvedValueOnce([autoSendCompany]) // AUTO_SEND query
        .mockResolvedValueOnce([]); // À appeler query

      const result = await service.runStateMachineTransitions();

      expect(result.autoSentBatchCount).toBe(1);
      expect(mailingService.sendInitialBatch).toHaveBeenCalled();
    });

    it('should move companies to TO_CALL after the call follow-up delay and notify', async () => {
      const dueCompany = { id: 'comp-due', name: 'Entreprise Échue' };

      prisma.company.findMany
        .mockResolvedValueOnce([]) // AUTO_SEND query
        .mockResolvedValueOnce([dueCompany]); // À appeler query

      const result = await service.runStateMachineTransitions();

      expect(result.transitionedToCall).toBe(1);
      const updateCall = prisma.company.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('comp-due');
      expect(updateCall.data.status).toBe(Status.TO_CALL);
      expect(pushService.sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(
            `${CALL_FOLLOW_UP_DELAY_DAYS} jours sans réponse`,
          ) as unknown,
        }),
      );
    });

    it('should no longer send automatic follow-up e-mails', async () => {
      await service.runStateMachineTransitions();
      expect(mailingService.sendFollowUp).not.toHaveBeenCalled();
    });

    it('should select companies whose last contact is older than the delay', async () => {
      const before = Date.now();
      await service.runStateMachineTransitions();

      const where = prisma.company.findMany.mock.calls[1][0]
        .where as Prisma.CompanyWhereInput;
      const firstMail = where.firstMailSentAt as { lte: Date };
      const expectedThreshold =
        before - CALL_FOLLOW_UP_DELAY_DAYS * 24 * 60 * 60 * 1000;

      expect(CALL_FOLLOW_UP_DELAY_DAYS).toBe(7);
      expect(
        Math.abs(firstMail.lte.getTime() - expectedThreshold),
      ).toBeLessThan(5000);
      expect(where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: Status.WAITING_FOR_REPLY }),
          { status: Status.TO_FOLLOW_UP, followUpSentAt: null },
        ]),
      );
    });
  });

  describe('handlePeriodicImapCheck', () => {
    it('should call mailingService.checkIncomingReplies', async () => {
      const res = await service.handlePeriodicImapCheck();
      expect(mailingService.checkIncomingReplies).toHaveBeenCalled();
      expect(res).toHaveProperty('repliesDetected', 1);
    });
  });
});
