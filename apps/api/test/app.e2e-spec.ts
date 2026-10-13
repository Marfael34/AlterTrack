process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
process.env.API_KEY = 'super_secret_test_api_key_minimum_16_chars';

import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface HealthResponseBody {
  status: string;
  database: string;
}

interface CompaniesResponseBody {
  items: unknown[];
  total: number;
}

describe('AlterTrack API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const testApiKey = 'super_secret_test_api_key_minimum_16_chars';

  const mockPrisma = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    company: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    appConfig: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        template: 'Test Template',
        cvFilePath: null,
        cvOriginalName: null,
        expoPushToken: null,
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health (GET) - Route publique sans clé API', async () => {
    const res: Response = await request(server).get('/health');
    expect(res.status).toBe(200);
    const body = res.body as HealthResponseBody;
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
  });

  it('/companies (GET) - Doit renvoyer 401 Unauthorized sans x-api-key', async () => {
    const res: Response = await request(server).get('/companies');
    expect(res.status).toBe(401);
  });

  it('/companies (GET) - Doit réussir avec la bonne clé x-api-key', async () => {
    const res: Response = await request(server)
      .get('/companies')
      .set('x-api-key', testApiKey);

    expect(res.status).toBe(200);
    const body = res.body as CompaniesResponseBody;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });
});
