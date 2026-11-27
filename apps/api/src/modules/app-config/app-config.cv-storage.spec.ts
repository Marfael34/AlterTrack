import {
  BadRequestException,
  InternalServerErrorException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AppConfigService,
  CV_MAX_SIZE_BYTES,
  CV_TOO_LARGE_MESSAGE,
  CV_UNSUPPORTED_FORMAT_MESSAGE,
} from './app-config.service';

const PDF_BUFFER = Buffer.from('%PDF-1.7\n%test\n%%EOF');

function makeFile(buffer: Buffer, originalname = 'cv.pdf') {
  return {
    buffer,
    originalname,
    mimetype: 'application/pdf',
    size: buffer.length,
  } as Express.Multer.File;
}

describe('AppConfigService — stockage du CV', () => {
  let uploadDir: string;
  let service: AppConfigService;
  let prisma: {
    appConfig: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let config: { id: string; cvFilePath: string | null; template: string };
  let userRecord: { fullName: string; cvFilePath: string | null };

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'altertrack-cv-'));
    config = { id: 'cfg', cvFilePath: null, template: 'T' };
    userRecord = { fullName: 'Raphael Martinez', cvFilePath: null };

    prisma = {
      appConfig: {
        findFirst: jest.fn(() => Promise.resolve(config)),
        create: jest.fn(),
        update: jest.fn((args: { data: object }) =>
          Promise.resolve({ ...config, ...args.data }),
        ),
      },
      user: {
        findUnique: jest.fn(() => Promise.resolve(userRecord)),
        update: jest.fn((args: { data: object }) =>
          Promise.resolve({ ...userRecord, ...args.data }),
        ),
        count: jest.fn(() => Promise.resolve(0)),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const configService = {
      get: jest.fn(() => uploadDir),
    } as unknown as ConfigService;

    service = new AppConfigService(
      prisma as unknown as PrismaService,
      configService,
    );
  });

  afterEach(() => {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  const listPdfFiles = () => fs.readdirSync(uploadDir);

  it('enregistre un PDF valide avec ses métadonnées', async () => {
    const result = await service.saveCv(makeFile(PDF_BUFFER), 'user-1');

    expect(result.cvOriginalName).toBe('martinez_raphael_CV.pdf');
    expect(result.cvFileSize).toBe(PDF_BUFFER.length);
    expect(result.cvUploadedAt).toBeInstanceOf(Date);
    expect(listPdfFiles()).toHaveLength(1);
    expect(listPdfFiles()[0]).toMatch(/^cv_user-1_.*\.pdf$/);
  });

  it('refuse un fichier qui n’est pas un PDF, même nommé .pdf', async () => {
    await expect(
      service.saveCv(makeFile(Buffer.from('MZ fake exe'), 'cv.pdf'), 'user-1'),
    ).rejects.toThrow(new BadRequestException(CV_UNSUPPORTED_FORMAT_MESSAGE));
    expect(listPdfFiles()).toHaveLength(0);
  });

  it('refuse un fichier de plus de 10 Mo', async () => {
    const big = Buffer.concat([PDF_BUFFER, Buffer.alloc(CV_MAX_SIZE_BYTES)]);
    await expect(service.saveCv(makeFile(big), 'user-1')).rejects.toThrow(
      new PayloadTooLargeException(CV_TOO_LARGE_MESSAGE),
    );
  });

  it('remplace l’ancien CV seulement après un enregistrement réussi', async () => {
    const oldPath = path.join(uploadDir, 'cv_user-1_old.pdf');
    fs.writeFileSync(oldPath, PDF_BUFFER);
    userRecord.cvFilePath = oldPath;
    config.cvFilePath = oldPath;

    await service.saveCv(makeFile(PDF_BUFFER), 'user-1');

    expect(fs.existsSync(oldPath)).toBe(false);
    expect(listPdfFiles()).toHaveLength(1);
  });

  it('conserve l’ancien CV et ne laisse aucun fichier si la base échoue', async () => {
    const oldPath = path.join(uploadDir, 'cv_user-1_old.pdf');
    fs.writeFileSync(oldPath, PDF_BUFFER);
    userRecord.cvFilePath = oldPath;
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.saveCv(makeFile(PDF_BUFFER), 'user-1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(listPdfFiles()).toEqual(['cv_user-1_old.pdf']);
  });

  it('ne supprime pas le CV global s’il appartient à un autre compte', async () => {
    const otherUserPath = path.join(uploadDir, 'cv_user-2.pdf');
    fs.writeFileSync(otherUserPath, PDF_BUFFER);
    config.cvFilePath = otherUserPath;
    prisma.user.count.mockResolvedValue(1);

    await service.saveCv(makeFile(PDF_BUFFER), 'user-1');

    expect(fs.existsSync(otherUserPath)).toBe(true);
  });

  it('ignore un chemin enregistré dont le fichier a disparu', () => {
    expect(
      service.resolveStoredFile(path.join(uploadDir, 'disparu.pdf')),
    ).toBeNull();
    expect(service.resolveStoredFile('/etc/passwd')).toBeNull();
  });
});
