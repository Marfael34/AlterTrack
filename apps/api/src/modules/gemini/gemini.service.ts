import { GoogleGenAI } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailNature,
  GenerateEmailDto,
  GeneratedEmailResult,
} from './dto/generate-email.dto';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly aiClient: GoogleGenAI | null = null;
  private readonly modelName = 'gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('geminiApiKey');
    if (apiKey && apiKey !== 'AIzaSyFakeKeyForDemonstrationOnly') {
      this.aiClient = new GoogleGenAI({ apiKey });
      this.logger.log('Client Google Gemini initialisé avec succès.');
    } else {
      this.logger.warn(
        'Clé GEMINI_API_KEY non configurée ou valeur par défaut : les fallbacks automatiques seront utilisés.',
      );
    }
  }

  async generateEmail(dto: GenerateEmailDto): Promise<GeneratedEmailResult> {
    if (!this.aiClient) {
      this.logger.log(
        `Gemini non disponible, application du template de repli pour ${dto.companyName}`,
      );
      return this.generateFallback(dto);
    }

    try {
      const systemInstruction = `Tu es un assistant de rédaction d'e-mails professionnels de candidature pour un contrat d'alternance.
Règles strictes :
1. Reste poli, concis, percutant et professionnel.
2. Basse-toi strictement sur le modèle de texte fourni par l'utilisateur.
3. Ne fais aucune hallucination : n'invente pas d'expérience, d'études ou de compétences qui ne figurent pas dans le modèle.
4. Si la nature est 'FIRST_CONTACT', adapte subtilement la prise de contact pour l'entreprise ${dto.companyName}.
5. Si la nature est 'FOLLOW_UP', rédige une relance courtoise et brève (rappelant qu'un premier mail avec CV a été envoyé il y a une semaine sans réponse).
6. Tu DOIS impérativement répondre au format JSON strict avec exactement deux clés : "subject" (l'objet de l'e-mail) et "body" (le texte complet de l'e-mail).`;

      const prompt = `Entreprise cible : "${dto.companyName}"
Nature de l'envoi : "${dto.nature}"
Modèle de référence :
"""
${dto.template}
"""

Génère l'e-mail adapté au format JSON :
{
  "subject": "Objet du mail",
  "body": "Corps du mail"
}`;

      const response = await this.aiClient.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Réponse vide reçue de Gemini');
      }

      const parsed = JSON.parse(responseText) as Partial<GeneratedEmailResult>;

      if (!parsed.subject || !parsed.body) {
        throw new Error('Structure JSON incomplète reçue de Gemini');
      }

      return {
        subject: parsed.subject.trim(),
        body: parsed.body.trim(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'appel à l'API Gemini pour ${dto.companyName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.generateFallback(dto);
    }
  }

  private generateFallback(dto: GenerateEmailDto): GeneratedEmailResult {
    const isFollowUp = dto.nature === EmailNature.FOLLOW_UP;

    if (isFollowUp) {
      return {
        subject: `Relance : Candidature Alternance — ${dto.companyName}`,
        body: `Bonjour,\n\nJe me permets de revenir vers vous concernant ma candidature en alternance transmise la semaine dernière pour ${dto.companyName}.\n\nToujours très motivé à l'idée d'échanger avec votre équipe, je vous joins à nouveau mon CV pour faciliter votre consultation.\n\nRestant à votre entière disposition,\n\nBien cordialement,`,
      };
    }

    const personalizedBody = dto.template.includes('[Entreprise]')
      ? dto.template.replace(/\[Entreprise\]/g, dto.companyName)
      : dto.template;

    return {
      subject: `Candidature Alternance — ${dto.companyName}`,
      body: personalizedBody,
    };
  }
}
