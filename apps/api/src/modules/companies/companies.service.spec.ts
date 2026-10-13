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
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  const mockCompany = {
    id: 'comp-uuid-1',
    name: 'Entreprise Test',
    email: 'contact@test.com',
    city: 'Paris',
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
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([mockCompany]),
        findUnique: jest.fn().mockResolvedValue(mockCompany),
        update: jest.fn().mockResolvedValue(mockCompany),
        delete: jest.fn().mockResolvedValue(mockCompany),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
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
          city: undefined,
          phone: undefined,
          notes: undefined,
          status: Status.TO_SEND,
        },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe('findAll', () => {
    it('should filter by city when provided', async () => {
      await service.findAll({ city: 'Béziers', limit: 50, offset: 0 });
      expect(prisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            city: { contains: 'Béziers', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should sort by name ascending when requested', async () => {
      await service.findAll({ sortBy: 'name', sortOrder: 'asc', limit: 50, offset: 0 });
      expect(prisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('should filter by multiple statuses when statuses array is provided', async () => {
      await service.findAll({
        statuses: [Status.TO_SEND, Status.TO_CALL],
        limit: 50,
        offset: 0,
      });
      expect(prisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [Status.TO_SEND, Status.TO_CALL] },
          }),
        }),
      );
    });
  });

  describe('getCities', () => {
    it('should return aggregated and sorted cities', async () => {
      prisma.company.findMany.mockResolvedValueOnce([
        { city: 'Perpignan' },
        { city: 'Montpellier' },
        { city: 'Perpignan' },
      ]);

      const result = await service.getCities();
      expect(result).toEqual([
        { city: 'Perpignan', count: 2 },
        { city: 'Montpellier', count: 1 },
      ]);
    });
  });

  describe('removeBatch', () => {
    it('should delete specified companies by IDs', async () => {
      const result = await service.removeBatch({ ids: ['id-1', 'id-2'] });
      expect(prisma.company.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2'] } },
      });
      expect(result.deletedCount).toBe(2);
    });

    it('should delete all companies when all is true', async () => {
      const result = await service.removeBatch({ all: true });
      expect(prisma.company.deleteMany).toHaveBeenCalledWith({});
      expect(result.deletedCount).toBe(2);
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

  describe('importFromSpreadsheet', () => {
    it('should import valid companies from CSV buffer', async () => {
      const csvContent =
        'Nom,Email,Telephone,Notes,Statut\nGoogle,recrutement@google.com,0611223344,Stage alternance,A envoyer\nMicrosoft,jobs@microsoft.com,,Poste dev,En attente';
      const buffer = Buffer.from(csvContent, 'utf-8');

      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'new-id', ...data }),
      );

      const result = await service.importFromSpreadsheet(buffer);

      expect(result.importedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.imported[0].name).toBe('Google');
      expect(result.imported[0].status).toBe(Status.TO_SEND);
      expect(result.imported[1].name).toBe('Microsoft');
      expect(result.imported[1].status).toBe(Status.WAITING_FOR_REPLY);
    });

    it('should support duplicate emails and fallback emails without skipping', async () => {
      const csvContent =
        'Nom,Email\nValidCorp,valid@corp.fr\nBadEmailCorp,not-an-email\nValidCorpDup,valid@corp.fr';
      const buffer = Buffer.from(csvContent, 'utf-8');

      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'id-1', ...data }),
      );

      const result = await service.importFromSpreadsheet(buffer);

      expect(result.importedCount).toBe(3);
      expect(result.skippedCount).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should assign null or defaults for empty cells and import without error', async () => {
      const csvContent =
        'Nom,Email,Ville,Telephone,Notes\n' +
        ',test@emptyname.com,,,\n' + // Pas de nom, ville/tel/notes vides
        'SoloCompany,,,,\n'; // Juste un nom, pas d'email, ville/tel/notes vides
      const buffer = Buffer.from(csvContent, 'utf-8');

      const createdEntries: any[] = [];
      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.create.mockImplementation(({ data }: any) => {
        createdEntries.push(data);
        return Promise.resolve({ id: 'id-test', ...data });
      });

      const result = await service.importFromSpreadsheet(buffer);

      expect(result.importedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.errors.length).toBe(0);

      // Première ligne : nom par défaut "Entreprise 2", email valide, champs vides à null
      expect(createdEntries[0].name).toBe('Entreprise 2');
      expect(createdEntries[0].email).toBe('test@emptyname.com');
      expect(createdEntries[0].city).toBeNull();
      expect(createdEntries[0].phone).toBeNull();

      // Deuxième ligne : nom préservé, email fallback par défaut, champs vides à null
      expect(createdEntries[1].name).toBe('SoloCompany');
      expect(createdEntries[1].email).toMatch(/solocompany\.3@sans-email\.altertrack/);
      expect(createdEntries[1].city).toBeNull();
      expect(createdEntries[1].phone).toBeNull();
    });
  });
});
