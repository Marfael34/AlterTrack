import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';

export interface IncomingEmailHeader {
  uid: number;
  fromAddress: string;
  fromDomain: string;
  subject: string;
  date: Date;
}

@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);
  private readonly isConfigured: boolean = false;
  private readonly user: string | null = null;
  private readonly pass: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('gmailUser');
    const pass = this.configService.get<string>('gmailAppPassword');

    if (user && pass && user !== 'mon.adresse@gmail.com') {
      this.user = user;
      this.pass = pass;
      this.isConfigured = true;
      this.logger.log(`Service IMAP Gmail configuré pour ${user}`);
    } else {
      this.logger.warn(
        'Identifiants Gmail IMAP non configurés ou fictifs : mode simulation activé.',
      );
    }
  }

  async fetchRecentIncomingEmails(
    sinceDate?: Date,
  ): Promise<IncomingEmailHeader[]> {
    if (!this.isConfigured || !this.user || !this.pass) {
      this.logger.log(
        '[SIMULATION IMAP] Aucun message entrant relevé (mode simulation)',
      );
      return [];
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: this.user,
        pass: this.pass,
      },
      logger: false,
    });

    const incomingEmails: IncomingEmailHeader[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const since = sinceDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const searchCriteria = { since };

        for await (const message of client.fetch(searchCriteria, {
          envelope: true,
          uid: true,
        })) {
          const fromAddress =
            message.envelope?.from?.[0]?.address?.toLowerCase();
          const subject = message.envelope?.subject || '';
          const date = message.envelope?.date
            ? new Date(message.envelope.date)
            : new Date();

          if (fromAddress) {
            const domainParts = fromAddress.split('@');
            const fromDomain = domainParts.length > 1 ? domainParts[1] : '';

            incomingEmails.push({
              uid: message.uid,
              fromAddress,
              fromDomain,
              subject,
              date,
            });
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (error) {
      this.logger.error(
        `Erreur lors de la relève IMAP Gmail : ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return incomingEmails;
  }
}
