import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: any;

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
      $queryRaw: jest.fn().mockResolvedValue([]),
      companyActivity: {
        create: jest.fn().mockResolvedValue({ id: 'act-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'act-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'act-1' }),
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
    it('should create a company with default status AUTO_SEND', async () => {
      const result = await service.create({
        name: 'Entreprise Test',
        email: 'contact@test.com',
      });

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Entreprise Test',
          email: 'contact@test.com',
          address: undefined,
          city: undefined,
          latitude: undefined,
          longitude: undefined,
          phone: undefined,
          notes: undefined,
          status: Status.AUTO_SEND,
          userId: undefined,
        },
        include: {
          activities: {
            orderBy: { performedAt: 'desc' },
          },
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
      await service.findAll({
        sortBy: 'name',
        sortOrder: 'asc',
        limit: 50,
        offset: 0,
      });
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

  describe('findAll — derniers événements', () => {
    it('charge les événements de toute la page en une seule requête', async () => {
      const recent = {
        id: 'act-9',
        companyId: mockCompany.id,
        type: 'CALL',
        title: 'Appel RH',
        performedAt: new Date('2026-11-25T10:00:00Z'),
      };
      prisma.$queryRaw.mockResolvedValueOnce([recent]);

      const result = await service.findAll({ limit: 50, offset: 0 });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.items[0].recentActivities).toEqual([
        {
          id: 'act-9',
          type: 'CALL',
          title: 'Appel RH',
          performedAt: recent.performedAt,
        },
      ]);
    });

    it("n'interroge pas l'historique quand la liste est vide", async () => {
      prisma.company.findMany.mockResolvedValueOnce([]);
      prisma.company.count.mockResolvedValueOnce(0);

      const result = await service.findAll({ limit: 50, offset: 0 });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
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
      expect(prisma.company.deleteMany).toHaveBeenCalledWith({ where: {} });
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
        include: {
          activities: {
            orderBy: { performedAt: 'desc' },
          },
        },
      });
      expect(result.status).toEqual(Status.ACCEPTED);
    });
  });

  describe('getStats', () => {
    it('should return aggregated counts for all statuses', async () => {
      const stats = await service.getStats();
      expect(stats.TO_SEND).toBe(1);
      expect(stats.AUTO_SEND).toBe(0);
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
      expect(createdEntries[1].email).toMatch(
        /solocompany\.3@sans-email\.altertrack/,
      );
      expect(createdEntries[1].city).toBeNull();
      expect(createdEntries[1].phone).toBeNull();
    });

    it('should cleanly restore all table columns without dumping them into notes', async () => {
      const csvContent =
        'ID;Nom de l’entreprise;Email;Téléphone;Adresse;Ville;Statut;Latitude;Longitude;Notes;Premier e-mail envoyé le;Relance prévue le;Relance envoyée le;Dernier ID e-mail;Date de création;Dernière mise à jour\n' +
        '11111111-2222-3333-4444-555555555555;Tech Corp;contact@techcorp.fr;0102030405;10 rue de Paris;Paris;AUTO_SEND;48,8566;2,3522;Notes confidentielles;10/05/2024 14:30;17/05/2024 14:30;20/05/2024 09:00;msg-123;01/05/2024 10:00;10/05/2024 14:30';
      const buffer = Buffer.from(csvContent, 'utf-8');

      let createdData: any = null;
      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.company.create.mockImplementation(({ data }: any) => {
        createdData = data;
        return Promise.resolve({ id: data.id || 'new-id', ...data });
      });

      const result = await service.importFromSpreadsheet(buffer);

      expect(result.importedCount).toBe(1);
      expect(createdData).toBeDefined();
      expect(createdData.id).toBe('11111111-2222-3333-4444-555555555555');
      expect(createdData.name).toBe('Tech Corp');
      expect(createdData.email).toBe('contact@techcorp.fr');
      expect(createdData.phone).toBe('0102030405');
      expect(createdData.address).toBe('10 rue de Paris');
      expect(createdData.city).toBe('Paris');
      expect(createdData.status).toBe(Status.AUTO_SEND);
      expect(createdData.latitude).toBeCloseTo(48.8566, 4);
      expect(createdData.longitude).toBeCloseTo(2.3522, 4);
      // Les notes doivent être uniquement "Notes confidentielles" et NON polluées par les autres colonnes
      expect(createdData.notes).toBe('Notes confidentielles');
      expect(createdData.notes).not.toContain('Latitude');
      expect(createdData.notes).not.toContain('Statut');
      expect(createdData.notes).not.toContain('Premier e-mail');
      expect(createdData.firstMailSentAt).toBeInstanceOf(Date);
      expect(createdData.followUpReadyAt).toBeInstanceOf(Date);
      expect(createdData.followUpSentAt).toBeInstanceOf(Date);
      expect(createdData.lastMailId).toBe('msg-123');
    });

    it('should update all table columns on existing company match', async () => {
      const csvContent =
        'Nom de l’entreprise;Email;Téléphone;Adresse;Ville;Statut;Latitude;Longitude;Notes\n' +
        'Existing Corp;existing@corp.fr;0600000000;20 avenue Foch;Lyon;WAITING_FOR_REPLY;45,7640;4,8357;Note mise à jour';
      const buffer = Buffer.from(csvContent, 'utf-8');

      const existingRecord = {
        id: 'existing-id-123',
        name: 'Existing Corp',
        email: 'existing@corp.fr',
        phone: '0100000000',
        address: 'Ancienne adresse',
        city: 'Marseille',
        status: Status.TO_SEND,
        latitude: null,
        longitude: null,
        notes: 'Ancienne note',
        firstMailSentAt: null,
        followUpReadyAt: null,
        followUpSentAt: null,
        lastMailId: null,
      };

      prisma.company.findFirst.mockResolvedValue(existingRecord);
      let updatedData: any = null;
      prisma.company.update.mockImplementation(({ data }: any) => {
        updatedData = data;
        return Promise.resolve({ ...existingRecord, ...data });
      });

      const result = await service.importFromSpreadsheet(buffer);

      expect(result.importedCount).toBe(1);
      expect(updatedData).toBeDefined();
      expect(updatedData.address).toBe('20 avenue Foch');
      expect(updatedData.city).toBe('Lyon');
      expect(updatedData.phone).toBe('0600000000');
      expect(updatedData.status).toBe(Status.WAITING_FOR_REPLY);
      expect(updatedData.latitude).toBeCloseTo(45.764, 3);
      expect(updatedData.longitude).toBeCloseTo(4.8357, 3);
      expect(updatedData.notes).toBe('Note mise à jour');
    });
  });

  describe('exportToSpreadsheet', () => {
    it('should export all database columns in 1-to-1 spreadsheet structure', async () => {
      const fakeCompanies = [
        {
          id: 'comp-uuid-1',
          name: 'Alpha Industrie',
          email: 'rh@alphaindustrie.com',
          phone: '0140506070',
          address: '5 rue de la Paix',
          city: 'Paris',
          status: Status.AUTO_SEND,
          latitude: 48.8698,
          longitude: 2.3312,
          notes: 'Dossier urgent',
          firstMailSentAt: new Date('2024-05-10T14:30:00Z'),
          followUpReadyAt: new Date('2024-05-17T14:30:00Z'),
          followUpSentAt: null,
          lastMailId: 'msg-abc',
          createdAt: new Date('2024-05-01T10:00:00Z'),
          updatedAt: new Date('2024-05-10T14:30:00Z'),
          activities: [
            {
              id: 'act-1',
              type: 'EMAIL_SENT',
              title: 'Candidature envoyée',
              description: 'Email de candidature avec CV',
              performedAt: new Date('2024-05-10T14:30:00Z'),
            },
          ],
        },
      ];

      prisma.company.findMany.mockResolvedValue(fakeCompanies as any);

      const result = await service.exportToSpreadsheet('user-1', 'xlsx');

      expect(result).toBeDefined();
      expect(result.count).toBe(1);
      expect(result.contentType).toContain('openxmlformats');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should perform a full faithful round-trip: export to CSV -> import from CSV', async () => {
      const originalCompany = {
        id: '22222222-3333-4444-5555-666666666666',
        userId: 'user-roundtrip',
        name: 'Beta Services',
        email: 'recrutement@betaservices.fr',
        phone: '0612345678',
        address: '15 boulevard Haussmann',
        city: 'Paris',
        status: Status.WAITING_FOR_REPLY,
        latitude: 48.8738,
        longitude: 2.3371,
        notes: 'Contact RH très réactif, relance le matin',
        firstMailSentAt: new Date('2024-06-01T09:00:00Z'),
        followUpReadyAt: new Date('2024-06-08T09:00:00Z'),
        followUpSentAt: new Date('2024-06-08T10:30:00Z'),
        lastMailId: 'gmail-msg-888',
        createdAt: new Date('2024-05-20T08:00:00Z'),
        updatedAt: new Date('2024-06-08T10:30:00Z'),
        activities: [
          {
            id: 'act-1',
            type: 'EMAIL_SENT',
            title: 'Premier contact',
            description: 'Envoi candidature',
            performedAt: new Date('2024-06-01T09:00:00Z'),
          },
        ],
      };

      prisma.company.findMany.mockResolvedValue([originalCompany] as any);

      // 1. Exporter en CSV
      const exportRes = await service.exportToSpreadsheet(
        'user-roundtrip',
        'csv',
      );
      expect(exportRes.buffer).toBeInstanceOf(Buffer);

      // 2. Réimporter directement ce CSV
      let createdOnImport: any = null;
      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.company.create.mockImplementation(({ data }: any) => {
        createdOnImport = data;
        return Promise.resolve({ id: data.id || originalCompany.id, ...data });
      });

      const importRes = await service.importFromSpreadsheet(
        exportRes.buffer,
        'user-roundtrip',
      );

      expect(importRes.importedCount).toBe(1);
      expect(createdOnImport).toBeDefined();
      expect(createdOnImport.name).toBe('Beta Services');
      expect(createdOnImport.email).toBe('recrutement@betaservices.fr');
      expect(createdOnImport.phone).toBe('0612345678');
      expect(createdOnImport.address).toBe('15 boulevard Haussmann');
      expect(createdOnImport.city).toBe('Paris');
      expect(createdOnImport.status).toBe(Status.WAITING_FOR_REPLY);
      expect(createdOnImport.latitude).toBeCloseTo(48.8738, 3);
      expect(createdOnImport.longitude).toBeCloseTo(2.3371, 3);
      // STRICTEMENT les notes d'origine, aucune pollution par les colonnes
      expect(createdOnImport.notes).toBe(
        'Contact RH très réactif, relance le matin',
      );
      expect(createdOnImport.lastMailId).toBe('gmail-msg-888');
      expect(createdOnImport.firstMailSentAt).toBeInstanceOf(Date);
      expect(createdOnImport.followUpReadyAt).toBeInstanceOf(Date);
      expect(createdOnImport.followUpSentAt).toBeInstanceOf(Date);
    });

    it('should perform a full faithful round-trip: export to XLSX -> import from XLSX', async () => {
      const originalCompany = {
        id: '33333333-4444-5555-6666-777777777777',
        userId: 'user-roundtrip-xlsx',
        name: 'Gamma Tech',
        email: 'jobs@gammatech.io',
        phone: '0711223344',
        address: '42 rue de la République',
        city: 'Lyon',
        status: Status.TO_FOLLOW_UP,
        latitude: 45.764,
        longitude: 4.8357,
        notes: 'Entretien prévu la semaine prochaine',
        firstMailSentAt: new Date('2024-07-01T10:00:00Z'),
        followUpReadyAt: new Date('2024-07-08T10:00:00Z'),
        followUpSentAt: null,
        lastMailId: null,
        createdAt: new Date('2024-06-15T08:00:00Z'),
        updatedAt: new Date('2024-07-01T10:00:00Z'),
        activities: [],
      };

      prisma.company.findMany.mockResolvedValue([originalCompany] as any);

      // 1. Exporter en XLSX
      const exportRes = await service.exportToSpreadsheet(
        'user-roundtrip-xlsx',
        'xlsx',
      );
      expect(exportRes.buffer).toBeInstanceOf(Buffer);

      // 2. Réimporter directement ce XLSX
      let createdOnImport: any = null;
      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.company.create.mockImplementation(({ data }: any) => {
        createdOnImport = data;
        return Promise.resolve({ id: data.id || originalCompany.id, ...data });
      });

      const importRes = await service.importFromSpreadsheet(
        exportRes.buffer,
        'user-roundtrip-xlsx',
      );

      expect(importRes.importedCount).toBe(1);
      expect(createdOnImport).toBeDefined();
      expect(createdOnImport.name).toBe('Gamma Tech');
      expect(createdOnImport.email).toBe('jobs@gammatech.io');
      expect(createdOnImport.phone).toBe('0711223344');
      expect(createdOnImport.address).toBe('42 rue de la République');
      expect(createdOnImport.city).toBe('Lyon');
      expect(createdOnImport.status).toBe(Status.TO_FOLLOW_UP);
      expect(createdOnImport.latitude).toBeCloseTo(45.764, 3);
      expect(createdOnImport.longitude).toBeCloseTo(4.8357, 3);
      // STRICTEMENT les notes d'origine
      expect(createdOnImport.notes).toBe(
        'Entretien prévu la semaine prochaine',
      );
      expect(createdOnImport.firstMailSentAt).toBeInstanceOf(Date);
      expect(createdOnImport.followUpReadyAt).toBeInstanceOf(Date);
    });
  });
});
