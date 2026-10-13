import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailingService } from '../mailing/mailing.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { SchedulerService } from './scheduler.service';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let prisma: {
    company: {
      findMany: jest.Mock;
      update: jest.Mock<Promise<unknown>, [Prisma.CompanyUpdateArgs]>;
      count: jest.Mock;
    };
  };
  let mailingService: {
    sendFollowUp: jest.Mock;
    checkIncomingReplies: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([]),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailingService, useValue: mailingService },
        {
          provide: PushNotificationService,
          useValue: { sendPushNotification: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runStateMachineTransitions', () => {
    it('should transition J+7 companies from WAITING_FOR_REPLY to TO_FOLLOW_UP', async () => {
      const j7Company = {
        id: 'comp-j7',
        name: 'Entreprise J7',
        status: Status.WAITING_FOR_REPLY,
        firstMailSentAt: new Date(Date.now() - 7.5 * 24 * 60 * 60 * 1000),
        followUpSentAt: null,
      };

      prisma.company.findMany
        .mockResolvedValueOnce([j7Company]) // J+7 query
        .mockResolvedValueOnce([]) // J+8 query
        .mockResolvedValueOnce([]); // J+15 query

      const result = await service.runStateMachineTransitions();

      expect(result.transitionedToFollowUpJ7).toBe(1);
      const updateCall = prisma.company.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('comp-j7');
      expect(updateCall.data.status).toBe(Status.TO_FOLLOW_UP);
    });

    it('should trigger sendFollowUp for J+8 companies', async () => {
      const j8Company = {
        id: 'comp-j8',
        name: 'Entreprise J8',
        status: Status.TO_FOLLOW_UP,
        firstMailSentAt: new Date(Date.now() - 8.5 * 24 * 60 * 60 * 1000),
        followUpSentAt: null,
      };

      prisma.company.findMany
        .mockResolvedValueOnce([]) // J+7 query
        .mockResolvedValueOnce([j8Company]) // J+8 query
        .mockResolvedValueOnce([]); // J+15 query

      const result = await service.runStateMachineTransitions();

      expect(result.followUpsSentJ8).toBe(1);
      expect(mailingService.sendFollowUp).toHaveBeenCalledWith('comp-j8');
    });

    it('should transition J+15 companies to TO_CALL', async () => {
      const j15Company = {
        id: 'comp-j15',
        name: 'Entreprise J15',
        status: Status.WAITING_FOR_REPLY,
        firstMailSentAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
        followUpSentAt: new Date(Date.now() - 7.5 * 24 * 60 * 60 * 1000),
      };

      prisma.company.findMany
        .mockResolvedValueOnce([]) // J+7 query
        .mockResolvedValueOnce([]) // J+8 query
        .mockResolvedValueOnce([j15Company]); // J+15 query

      const result = await service.runStateMachineTransitions();

      expect(result.transitionedToCallJ15).toBe(1);
      const updateCall = prisma.company.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('comp-j15');
      expect(updateCall.data.status).toBe(Status.TO_CALL);
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
