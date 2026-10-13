import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailNature } from './dto/generate-email.dto';
import { GeminiService } from './gemini.service';

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null), // Mode fallback
          },
        },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateEmail fallback', () => {
    it('should generate personalized first contact email', async () => {
      const template = 'Bonjour, je postule chez [Entreprise].';
      const result = await service.generateEmail({
        companyName: 'Acme Corp',
        template,
        nature: EmailNature.FIRST_CONTACT,
      });

      expect(result.subject).toContain('Acme Corp');
      expect(result.body).toContain('Acme Corp');
      expect(result.body).not.toContain('[Entreprise]');
    });

    it('should generate polite follow-up email', async () => {
      const result = await service.generateEmail({
        companyName: 'Acme Corp',
        template: 'Mon template',
        nature: EmailNature.FOLLOW_UP,
      });

      expect(result.subject).toContain('Relance');
      expect(result.subject).toContain('Acme Corp');
      expect(result.body).toContain('revenir vers vous');
    });
  });
});
