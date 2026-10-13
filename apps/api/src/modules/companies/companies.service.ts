import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        name: createDto.name,
        email: createDto.email,
        city: createDto.city,
        phone: createDto.phone,
        notes: createDto.notes,
        status: createDto.status ?? Status.TO_SEND,
      },
    });
  }

  async findAll(query: QueryCompanyDto) {
    const where: Prisma.CompanyWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(`Entreprise avec l'ID ${id} non trouvée`);
    }

    return company;
  }

  async update(id: string, updateDto: UpdateCompanyDto) {
    await this.findOne(id);

    return this.prisma.company.update({
      where: { id },
      data: updateDto,
    });
  }

  async updateStatus(id: string, status: Status) {
    await this.findOne(id);

    return this.prisma.company.update({
      where: { id },
      data: { status },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.company.delete({
      where: { id },
    });
  }

  async removeBatch(body: { ids?: string[]; all?: boolean }) {
    if (body.all) {
      const result = await this.prisma.company.deleteMany({});
      this.logger.log(
        `Suppression totale : ${result.count} entreprise(s) supprimée(s)`,
      );
      return { deletedCount: result.count };
    }

    if (!body.ids || body.ids.length === 0) {
      throw new BadRequestException(
        'Aucun identifiant fourni pour la suppression groupée',
      );
    }

    const result = await this.prisma.company.deleteMany({
      where: { id: { in: body.ids } },
    });
    this.logger.log(
      `Suppression groupée : ${result.count} entreprise(s) supprimée(s)`,
    );

    return { deletedCount: result.count };
  }

  async getStats() {
    const groups = await this.prisma.company.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const stats: Record<string, number> = {
      TO_SEND: 0,
      WAITING_FOR_REPLY: 0,
      TO_FOLLOW_UP: 0,
      TO_CALL: 0,
      REPLY_RECEIVED: 0,
      REFUSED: 0,
      ACCEPTED: 0,
    };

    for (const group of groups) {
      stats[group.status] = group._count.id;
    }

    return stats;
  }

  private readonly logger = new Logger(CompaniesService.name);

  async importFromSpreadsheet(fileBuffer: Buffer) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Le fichier reçu est vide (0 octet)');
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer', cellFormula: true });
    } catch (err) {
      this.logger.error(`Erreur lecture XLSX: ${String(err)}`);
      throw new BadRequestException(
        'Impossible de lire le fichier tableur. Vérifiez le format (Excel .xlsx/.xls ou CSV).',
      );
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new BadRequestException('Le tableur ne contient aucune feuille');
    }

    this.logger.log(
      `Analyse du tableur (${fileBuffer.length} octets) : ${workbook.SheetNames.length} feuille(s) trouvée(s) [${workbook.SheetNames.join(', ')}]`,
    );

    const EMAIL_EXTRACT_REGEX =
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
    const errors: string[] = [];
    const imported: Array<{
      id: string;
      name: string;
      email: string;
      city?: string | null;
      status: Status;
    }> = [];
    const seenEmailsInBatch = new Set<string>();
    let skippedCount = 0;
    let totalDetectedRows = 0;

    const normalizeStr = (val: unknown): string =>
      String(val ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    // Parcourir toutes les feuilles du classeur pour ne rien rater
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const rawRows = XLSX.utils.sheet_to_json<Array<string | number>>(
        worksheet,
        { header: 1, defval: '' },
      );

      // Conserver les lignes contenant au moins une cellule non vide
      const nonEmptyRowIndices: number[] = [];
      const nonEmptyRows: Array<Array<string | number>> = [];

      rawRows.forEach((r, idx) => {
        if (
          Array.isArray(r) &&
          r.some((c) => String(c ?? '').trim().length > 0)
        ) {
          nonEmptyRowIndices.push(idx);
          nonEmptyRows.push(r);
        }
      });

      if (nonEmptyRows.length === 0) {
        continue;
      }

      this.logger.log(
        `Feuille "${sheetName}" : ${nonEmptyRows.length} ligne(s) non vide(s) détectée(s)`,
      );

      // 1. Détection intelligente de la ligne d'en-tête par score
      let bestHeaderIdx = -1;
      let bestScore = -1;
      let bestColMap = {
        name: -1,
        email: -1,
        city: -1,
        phone: -1,
        notes: -1,
        status: -1,
      };

      for (let i = 0; i < Math.min(nonEmptyRows.length, 25); i++) {
        const row = nonEmptyRows[i];
        if (!Array.isArray(row)) continue;

        const filledCells = row.filter(
          (c) => String(c ?? '').trim().length > 0,
        );
        if (filledCells.length === 0) continue;

        // Pénalité pour les bannières / titres sur 1 seule cellule
        let score = filledCells.length >= 2 ? 3 : -15;
        const tempMap = {
          name: -1,
          email: -1,
          city: -1,
          phone: -1,
          notes: -1,
          status: -1,
        };

        row.forEach((cell, colIdx) => {
          const norm = normalizeStr(cell);
          if (!norm) return;

          if (
            tempMap.name === -1 &&
            (norm === 'nom' ||
              norm === 'name' ||
              norm.includes('entreprise') ||
              norm.includes('societe') ||
              norm.includes('company') ||
              norm.includes('raison') ||
              norm.includes('boite') ||
              norm.includes('employeur') ||
              norm.includes('structure') ||
              norm.includes('cible') ||
              norm.includes('organisme') ||
              norm.includes('partenaire') ||
              norm.includes('organisation') ||
              norm.includes('groupe') ||
              norm.includes('compagnie') ||
              norm.includes('agence'))
          ) {
            tempMap.name = colIdx;
            score += 10;
          } else if (
            tempMap.email === -1 &&
            (norm.includes('email') ||
              norm.includes('courriel') ||
              norm.includes('mel') ||
              norm.includes('mail') ||
              norm.includes('e-mail') ||
              norm.includes('adresse electronique'))
          ) {
            tempMap.email = colIdx;
            score += 10;
          } else if (
            tempMap.city === -1 &&
            (norm === 'ville' ||
              norm === 'city' ||
              norm.includes('commune') ||
              norm.includes('lieu') ||
              norm.includes('localisation') ||
              norm.includes('secteur') ||
              norm.includes('adresse physique') ||
              norm.includes('cp / ville'))
          ) {
            tempMap.city = colIdx;
            score += 5;
          } else if (
            tempMap.phone === -1 &&
            (norm.includes('tel') ||
              norm.includes('phone') ||
              norm.includes('mobile') ||
              norm.includes('portable') ||
              norm.includes('fixe') ||
              norm.includes('standard'))
          ) {
            tempMap.phone = colIdx;
            score += 5;
          } else if (
            tempMap.status === -1 &&
            (norm.includes('statut') ||
              norm.includes('status') ||
              norm.includes('etat') ||
              norm.includes('etape') ||
              norm.includes('phase') ||
              norm.includes('avancement') ||
              norm.includes('suivi'))
          ) {
            tempMap.status = colIdx;
            score += 5;
          } else if (
            tempMap.notes === -1 &&
            (norm.includes('note') ||
              norm.includes('comm') ||
              norm.includes('remarqu') ||
              norm.includes('poste') ||
              norm.includes('desc') ||
              norm.includes('offre') ||
              norm.includes('lien') ||
              norm.includes('url') ||
              norm.includes('metier') ||
              norm.includes('ville') ||
              norm.includes('lieu') ||
              norm.includes('info'))
          ) {
            tempMap.notes = colIdx;
            score += 5;
          }
        });

        // Si la colonne email n'est pas trouvée par mot-clé explicite,
        // tester si une colonne s'appelle "contact" ou "coordonnees"
        if (tempMap.email === -1) {
          row.forEach((cell, colIdx) => {
            const norm = normalizeStr(cell);
            if (
              (norm.includes('contact') || norm.includes('coordonnee')) &&
              colIdx !== tempMap.name &&
              colIdx !== tempMap.phone
            ) {
              tempMap.email = colIdx;
              score += 6;
            }
          });
        }

        if (score > bestScore && score >= 8) {
          bestScore = score;
          bestHeaderIdx = i;
          bestColMap = tempMap;
        }
      }

      const headerRow =
        bestHeaderIdx !== -1 ? nonEmptyRows[bestHeaderIdx] : undefined;
      const dataStart = bestHeaderIdx !== -1 ? bestHeaderIdx + 1 : 0;
      this.logger.log(
        `Feuille "${sheetName}" : Ligne d'en-tête retenue = ${bestHeaderIdx} (score: ${bestScore}), colonnes: ` +
          `nom=${bestColMap.name}, email=${bestColMap.email}, tel=${bestColMap.phone}, notes=${bestColMap.notes}, statut=${bestColMap.status}`,
      );

      // Si le nom ou l'email n'a pas été détecté dans l'en-tête, heuristique par contenu
      if (bestColMap.name === -1) {
        for (let c = 0; c < 10; c++) {
          if (c !== bestColMap.email && c !== bestColMap.phone) {
            bestColMap.name = c;
            break;
          }
        }
      }

      if (bestColMap.email === -1) {
        // Scanner les premières lignes pour voir si une colonne contient toujours des adresses e-mail
        for (
          let i = dataStart;
          i < Math.min(nonEmptyRows.length, dataStart + 15);
          i++
        ) {
          const row = nonEmptyRows[i];
          if (!Array.isArray(row)) continue;
          row.forEach((cell, colIdx) => {
            if (
              EMAIL_EXTRACT_REGEX.test(String(cell ?? '')) &&
              bestColMap.email === -1
            ) {
              bestColMap.email = colIdx;
            }
          });
        }
      }

      // 2. Extraction et validation des lignes de données
      for (let i = dataStart; i < nonEmptyRows.length; i++) {
        const row = nonEmptyRows[i];
        if (!Array.isArray(row) || row.every((c) => !String(c ?? '').trim())) {
          continue;
        }

        totalDetectedRows++;
        const originalRowIdx = nonEmptyRowIndices[i] ?? i;
        const rowNum = originalRowIdx + 1;

        let rawName =
          bestColMap.name !== -1
            ? String(row[bestColMap.name] ?? '').trim()
            : '';
        let rawEmail = '';
        const rawCity =
          bestColMap.city !== -1
            ? String(row[bestColMap.city] ?? '').trim()
            : '';
        const rawPhone =
          bestColMap.phone !== -1
            ? String(row[bestColMap.phone] ?? '').trim()
            : '';
        let rawNotes =
          bestColMap.notes !== -1
            ? String(row[bestColMap.notes] ?? '').trim()
            : '';
        const rawStatus =
          bestColMap.status !== -1
            ? String(row[bestColMap.status] ?? '').trim()
            : '';

        // Recherche de l'e-mail dans la colonne désignée (texte ou lien hypertexte Excel)
        if (bestColMap.email !== -1) {
          const cellVal = row[bestColMap.email];
          const cellAddr = XLSX.utils.encode_cell({
            r: originalRowIdx,
            c: bestColMap.email,
          });
          const cellObj = worksheet[cellAddr] as
            | { l?: { Target?: string } }
            | undefined;

          // 1. Lien hypertexte mailto: ?
          if (cellObj?.l?.Target) {
            const match = cellObj.l.Target.match(EMAIL_EXTRACT_REGEX);
            if (match) rawEmail = match[0].toLowerCase();
          }

          // 2. Texte de la cellule ?
          if (!rawEmail && cellVal) {
            const match = String(cellVal).match(EMAIL_EXTRACT_REGEX);
            if (match) rawEmail = match[0].toLowerCase();
          }
        }

        // Si l'e-mail n'est pas encore trouvé, scanner TOUTES les cellules de la ligne
        if (!rawEmail) {
          row.forEach((cell, colIdx) => {
            if (rawEmail) return;
            const match = String(cell ?? '').match(EMAIL_EXTRACT_REGEX);
            if (match) {
              rawEmail = match[0].toLowerCase();
              return;
            }
            const cellAddr = XLSX.utils.encode_cell({
              r: originalRowIdx,
              c: colIdx,
            });
            const cellObj = worksheet[cellAddr] as
              | { l?: { Target?: string } }
              | undefined;
            if (cellObj?.l?.Target) {
              const linkMatch = cellObj.l.Target.match(EMAIL_EXTRACT_REGEX);
              if (linkMatch) rawEmail = linkMatch[0].toLowerCase();
            }
          });
        }

        // Si le nom est vide, chercher la première cellule textuelle qui n'est ni email ni téléphone
        if (!rawName) {
          const nameCell = row.find((c, idx) => {
            const s = String(c ?? '').trim();
            return (
              s.length > 0 &&
              !EMAIL_EXTRACT_REGEX.test(s) &&
              !/^[0-9+\s().-]{8,}$/.test(s) &&
              idx !== bestColMap.email &&
              idx !== bestColMap.phone
            );
          });
          if (nameCell) {
            rawName = String(nameCell).trim();
          }
        }

        // Si la ligne n'a toujours pas de nom d'entreprise valide, on la signale
        if (!rawName) {
          skippedCount++;
          errors.push(
            `Feuille "${sheetName}" Ligne ${rowNum} : Nom de l'entreprise manquant`,
          );
          continue;
        }

        // Si aucune adresse e-mail valide n'a été extraite :
        if (!rawEmail) {
          const colVal =
            bestColMap.email !== -1
              ? String(row[bestColMap.email] ?? '').trim()
              : '';

          const headerColName =
            bestColMap.email !== -1 && headerRow
              ? normalizeStr(headerRow[bestColMap.email])
              : '';
          const isExplicitEmailCol =
            headerColName.includes('mail') ||
            headerColName.includes('courriel') ||
            headerColName.includes('mel');

          const isPlaceholderOrIgnored =
            !colVal ||
            colVal === '-' ||
            colVal === '/' ||
            colVal.toLowerCase() === 'n/a' ||
            colVal.toLowerCase() === 'na' ||
            colVal.toLowerCase() === 'aucun' ||
            colVal.toLowerCase() === 'inconnu' ||
            colVal.toLowerCase().includes("pas d'email") ||
            colVal.toLowerCase().includes('a chercher');

          // Si la colonne s'appelle Contact / Interlocuteur (non-mail), conserver la valeur dans les notes
          if (colVal && !isExplicitEmailCol) {
            rawNotes = rawNotes
              ? `${rawNotes} [Contact: ${colVal}]`
              : `[Contact: ${colVal}]`;
          }

          // Si la colonne était explicitement nommée "Email/Mail" et contenait une valeur invalide
          if (
            bestColMap.email !== -1 &&
            isExplicitEmailCol &&
            !isPlaceholderOrIgnored
          ) {
            skippedCount++;
            errors.push(
              `Feuille "${sheetName}" Ligne ${rowNum} (${rawName}) : Adresse e-mail invalide (${colVal})`,
            );
            continue;
          }

          // Attribution d'une adresse de secours pour ne PAS perdre les entreprises du tableur
          const slug =
            rawName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, '')
              .slice(0, 15) || 'entreprise';
          rawEmail = `${slug}.${totalDetectedRows}@sans-email.altertrack`;
          rawNotes = rawNotes
            ? `${rawNotes} [Email à renseigner]`
            : '[Email à renseigner]';
        }

        // Dédoublonnage dans le lot d'importation
        if (seenEmailsInBatch.has(rawEmail)) {
          skippedCount++;
          errors.push(
            `Feuille "${sheetName}" Ligne ${rowNum} (${rawName}) : Doublon dans le fichier (${rawEmail})`,
          );
          continue;
        }
        seenEmailsInBatch.add(rawEmail);

        // Dédoublonnage avec la base existante
        const existing = await this.prisma.company.findFirst({
          where: { email: rawEmail },
        });

        if (existing) {
          skippedCount++;
          errors.push(
            `Feuille "${sheetName}" Ligne ${rowNum} (${rawName}) : ${rawEmail} est déjà enregistrée dans AlterTrack`,
          );
          continue;
        }

        // Résolution intelligente du statut
        let parsedStatus: Status = Status.TO_SEND;
        if (rawStatus) {
          const s = normalizeStr(rawStatus);
          if (
            s.includes('a envoyer') ||
            s.includes('to_send') ||
            s.includes('to send') ||
            s === 'nouveau' ||
            s === 'brouillon'
          ) {
            parsedStatus = Status.TO_SEND;
          } else if (
            s.includes('attente') ||
            s.includes('waiting') ||
            s.includes('envoye') ||
            s.includes('sent')
          ) {
            parsedStatus = Status.WAITING_FOR_REPLY;
          } else if (s.includes('relanc') || s.includes('follow')) {
            parsedStatus = Status.TO_FOLLOW_UP;
          } else if (s.includes('appel') || s.includes('call')) {
            parsedStatus = Status.TO_CALL;
          } else if (s.includes('repon') || s.includes('reply')) {
            parsedStatus = Status.REPLY_RECEIVED;
          } else if (s.includes('refus') || s.includes('rejet')) {
            parsedStatus = Status.REFUSED;
          } else if (
            s.includes('accept') ||
            s.includes('positif') ||
            s.includes('entretien')
          ) {
            parsedStatus = Status.ACCEPTED;
          }
        } else if (
          rawEmail.endsWith('@sans-email.altertrack') &&
          rawPhone.length > 0
        ) {
          // Si l'entreprise n'a pas d'email mais a un numéro de téléphone, suggérer "À appeler"
          parsedStatus = Status.TO_CALL;
        }

        // Enregistrement en base de données
        const created = await this.prisma.company.create({
          data: {
            name: rawName,
            email: rawEmail,
            city: rawCity || null,
            phone: rawPhone || null,
            notes: rawNotes || null,
            status: parsedStatus,
          },
        });

        imported.push({
          id: created.id,
          name: created.name,
          email: created.email,
          city: created.city,
          status: created.status,
        });
      }
    }

    this.logger.log(
      `Fin de l'import tableur : ${imported.length} importée(s), ${skippedCount} ignorée(s), ${totalDetectedRows} lignes lues au total`,
    );

    if (totalDetectedRows === 0) {
      errors.push(
        'Aucune ligne de données détectée. Vérifiez que votre tableau contient des lignes remplies sous vos en-têtes (Nom, Email...).',
      );
    }

    return {
      totalRows: totalDetectedRows,
      importedCount: imported.length,
      skippedCount,
      errors,
      imported,
    };
  }
}

