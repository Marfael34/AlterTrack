import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: {
    company: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  const mockCompany = {
    id: 'comp-uuid-1',
    name: 'Entreprise Test',
    email: 'contact@test.com',
    phone: '0601020304',
    notes: 'Note de test',
    status: Status.TO_SEND,
    firstMailSentAt: null,
    followUpReadyAt: null,
    followUpSentAt: null,
    lastMailId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      company: {
        create: jest.fn().mockResolvedValue(mockCompany),
        findMany: jest.fn().mockResolvedValue([mockCompany]),
        findUnique: jest.fn().mockResolvedValue(mockCompany),
        update: jest.fn().mockResolvedValue(mockCompany),
        delete: jest.fn().mockResolvedValue(mockCompany),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest
          .fn()
          .mockResolvedValue([{ status: Status.TO_SEND, _count: { id: 1 } }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a company with default status TO_SEND', async () => {
      const result = await service.create({
        name: 'Entreprise Test',
        email: 'contact@test.com',
      });

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Entreprise Test',
          email: 'contact@test.com',
          phone: undefined,
          notes: undefined,
          status: Status.TO_SEND,
        },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe('findOne', () => {
    it('should return a company by id', async () => {
      const result = await service.findOne('comp-uuid-1');
      expect(result).toEqual(mockCompany);
    });

    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update company status', async () => {
      const updated = { ...mockCompany, status: Status.ACCEPTED };
      prisma.company.update.mockResolvedValueOnce(updated);

      const result = await service.updateStatus('comp-uuid-1', Status.ACCEPTED);
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-uuid-1' },
        data: { status: Status.ACCEPTED },
      });
      expect(result.status).toEqual(Status.ACCEPTED);
    });
  });

  describe('getStats', () => {
    it('should return aggregated counts for all statuses', async () => {
      const stats = await service.getStats();
      expect(stats.TO_SEND).toBe(1);
      expect(stats.ACCEPTED).toBe(0);
    });
  });
});
