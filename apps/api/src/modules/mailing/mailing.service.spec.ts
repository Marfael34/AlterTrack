import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import { EmailNature } from '../gemini/dto/generate-email.dto';
import { GeminiService } from '../gemini/gemini.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { EmailService } from './email.service';
import { ImapService } from './imap.service';
import { MailingService } from './mailing.service';

describe('MailingService', () => {
  let service: MailingService;
  let prisma: any;
  let geminiService: {
    generateEmail: jest.Mock;
  };
  let emailService: {
    sendMail: jest.Mock;
    isConfigured: jest.Mock;
  };
  let imapService: {
    fetchRecentIncomingEmails: jest.Mock;
  };
  let appConfigService: {
    getOrCreateConfig: jest.Mock;
    getCvFilePath: jest.Mock;
  };

  const mockCompany = {
    id: 'comp-1',
    name: 'Tech Corp',
    email: 'contact@techcorp.fr',
    status: Status.AUTO_SEND,
    firstMailSentAt: null,
    followUpReadyAt: null,
    followUpSentAt: null,
    lastMailId: null,
  };

  beforeEach(async () => {
    prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([mockCompany]),
        findUnique: jest.fn().mockResolvedValue(mockCompany),
        findFirst: jest.fn().mockResolvedValue(mockCompany),
        update: jest
          .fn<Promise<unknown>, [Prisma.CompanyUpdateArgs]>()
          .mockResolvedValue({
            ...mockCompany,
            status: Status.WAITING_FOR_REPLY,
          }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    geminiService = {
      generateEmail: jest.fn().mockResolvedValue({
        subject: 'Candidature Alternance - Tech Corp',
        body: 'Corps du message',
      }),
    };

    emailService = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: '<msg-123@gmail.com>',
        hasAttachment: true,
        attachmentName: 'CV.pdf',
      }),
      isConfigured: jest.fn().mockReturnValue({
        configured: true,
        user: 'test@gmail.com',
      }),
    };

    imapService = {
      fetchRecentIncomingEmails: jest.fn().mockResolvedValue([]),
    };

    appConfigService = {
      getOrCreateConfig: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        template: 'Mon template',
        cvOriginalName: 'CV.pdf',
      }),
      getCvFilePath: jest.fn().mockResolvedValue('/tmp/cv.pdf'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailingService,
        { provide: PrismaService, useValue: prisma },
        { provide: GeminiService, useValue: geminiService },
        { provide: EmailService, useValue: emailService },
        { provide: ImapService, useValue: imapService },
        { provide: AppConfigService, useValue: appConfigService },
        {
          provide: PushNotificationService,
          useValue: { sendPushNotification: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<MailingService>(MailingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendInitialBatch', () => {
    it('should process AUTO_SEND companies, generate email, send it and update status', async () => {
      const result = await service.sendInitialBatch();

      expect(prisma.company.findMany).toHaveBeenCalled();
      expect(geminiService.generateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'Tech Corp',
          nature: EmailNature.FIRST_CONTACT,
        }),
      );
      expect(emailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'contact@techcorp.fr',
          subject: 'Candidature Alternance - Tech Corp',
        }),
      );
      const updateCall = prisma.company.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('comp-1');
      expect(updateCall.data.status).toBe(Status.WAITING_FOR_REPLY);
      expect(updateCall.data.lastMailId).toBe('<msg-123@gmail.com>');
      expect(result.successCount).toBe(1);
    });
  });

  describe('sendFollowUp (Règle Anti-Spam)', () => {
    it('should throw BadRequestException if followUpSentAt is already populated', async () => {
      prisma.company.findFirst.mockResolvedValueOnce({
        ...mockCompany,
        followUpSentAt: new Date(),
      });

      await expect(service.sendFollowUp('comp-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findFirst.mockResolvedValueOnce(null);

      await expect(service.sendFollowUp('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should send follow-up and update followUpSentAt when valid', async () => {
      prisma.company.findFirst.mockResolvedValueOnce(mockCompany);
      const result = await service.sendFollowUp('comp-1');

      expect(geminiService.generateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          nature: EmailNature.FOLLOW_UP,
        }),
      );
      const followUpCall = prisma.company.update.mock.calls[0][0];
      expect(followUpCall.where.id).toBe('comp-1');
      expect(followUpCall.data.status).toBe(Status.WAITING_FOR_REPLY);
      expect(followUpCall.data.followUpSentAt).toBeInstanceOf(Date);
      expect(result).toBeDefined();
    });
  });

  describe('checkIncomingReplies (IMAP Detection)', () => {
    it('should match incoming email by exact address and update status to REPLY_RECEIVED', async () => {
      imapService.fetchRecentIncomingEmails.mockResolvedValueOnce([
        {
          uid: 101,
          fromAddress: 'contact@techcorp.fr',
          fromDomain: 'techcorp.fr',
          subject: 'Re: Candidature',
          date: new Date(),
        },
      ]);

      prisma.company.findMany.mockResolvedValueOnce([
        {
          ...mockCompany,
          status: Status.WAITING_FOR_REPLY,
        },
      ]);

      const result = await service.checkIncomingReplies();

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { status: Status.REPLY_RECEIVED },
      });
      expect(result.repliesDetected).toBe(1);
    });

    it('should match incoming email by company domain', async () => {
      imapService.fetchRecentIncomingEmails.mockResolvedValueOnce([
        {
          uid: 102,
          fromAddress: 'recrutement-rh@techcorp.fr',
          fromDomain: 'techcorp.fr',
          subject: 'Votre candidature',
          date: new Date(),
        },
      ]);

      prisma.company.findMany.mockResolvedValueOnce([
        {
          ...mockCompany,
          status: Status.WAITING_FOR_REPLY,
        },
      ]);

      const result = await service.checkIncomingReplies();

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { status: Status.REPLY_RECEIVED },
      });
      expect(result.repliesDetected).toBe(1);
    });

    it('should NOT match by domain if it is a generic provider like gmail.com', async () => {
      imapService.fetchRecentIncomingEmails.mockResolvedValueOnce([
        {
          uid: 103,
          fromAddress: 'random.person@gmail.com',
          fromDomain: 'gmail.com',
          subject: 'Hello',
          date: new Date(),
        },
      ]);

      prisma.company.findMany.mockResolvedValueOnce([
        {
          ...mockCompany,
          email: 'recruteur.tech@gmail.com', // Même domaine générique mais adresse différente
          status: Status.WAITING_FOR_REPLY,
        },
      ]);

      const result = await service.checkIncomingReplies();

      expect(prisma.company.update).not.toHaveBeenCalled();
      expect(result.repliesDetected).toBe(0);
    });
  });

  describe('sendTestEmail', () => {
    it('should generate email with Gemini, attach CV and send test email to specified recipient', async () => {
      const result = await service.sendTestEmail(
        'candidat@test.com',
        'Entreprise Test',
      );

      expect(geminiService.generateEmail).toHaveBeenCalledWith({
        companyName: 'Entreprise Test',
        template: 'Mon template',
        nature: EmailNature.FIRST_CONTACT,
      });

      expect(emailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'candidat@test.com',
          attachmentPath: '/tmp/cv.pdf',
          attachmentName: 'CV.pdf',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('candidat@test.com');
      expect(result.hasAttachment).toBe(true);
      expect(result.isSimulation).toBe(false);
    });
  });
});
