import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  private static readonly cityCache = new Map<string, { latitude: number; longitude: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async geocodeQuery(
    queryText: string,
    type?: 'municipality' | 'housenumber' | 'street',
    lat?: number,
    lon?: number,
  ): Promise<{ latitude: number; longitude: number; score?: number } | null> {
    if (!queryText || queryText.trim().length < 2) return null;
    try {
      const typeParam = type ? `&type=${type}` : '';
      const proxParam =
        typeof lat === 'number' && typeof lon === 'number' ? `&lat=${lat}&lon=${lon}` : '';
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(queryText.trim())}${typeParam}${proxParam}&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        features?: Array<{
          properties?: { score?: number; type?: string; city?: string; name?: string };
          geometry: { coordinates: [number, number] };
        }>;
      };
      if (data.features && data.features.length > 0) {
        const feat = data.features[0];
        const [featLon, featLat] = feat.geometry.coordinates;
        return { latitude: featLat, longitude: featLon, score: feat.properties?.score };
      }
    } catch {
      // Ignorer silencieusement si API inaccessible
    }
    return null;
  }

  /**
   * Géocode en combinant l'adresse ET la ville / commune avec validation stricte
   */
  async geocodeAddress(address?: string | null, city?: string | null): Promise<{ latitude: number; longitude: number } | null> {
    const cleanAddr = address?.trim() || '';
    let cleanCity = city?.trim() || '';

    // Détecter les faux noms de ville (ex: "Toute la france", "France entière", "Distanciel", "Télétravail", "Full remote", "Partout")
    const INVALID_CITY_REGEX =
      /^(toute\s+la\s+france|france\s+enti[eè]re|partout|t[eé]l[eé]travail|remote|full\s*remote|distanciel|en\s+ligne|n\/?a|inconnu)$/i;
    if (INVALID_CITY_REGEX.test(cleanCity)) {
      if (!cleanAddr) return null;
      cleanCity = '';
    }

    // Si plusieurs villes sont mentionnées (ex: "Lyon / Paris" ou "Toulouse, Montpellier"), prendre la première
    const parsedCity = cleanCity ? cleanCity.split(/[\/,]/)[0].trim() : '';

    // Résoudre d'abord les coordonnées de la commune avec mise en cache et type=municipality obligatoire
    let cityCoords: { latitude: number; longitude: number } | null = null;
    if (parsedCity) {
      const cacheKey = parsedCity.toLowerCase();
      if (CompaniesService.cityCache.has(cacheKey)) {
        cityCoords = CompaniesService.cityCache.get(cacheKey)!;
      } else {
        const res = await this.geocodeQuery(parsedCity, 'municipality');
        if (res) {
          cityCoords = { latitude: res.latitude, longitude: res.longitude };
          CompaniesService.cityCache.set(cacheKey, cityCoords);
        }
      }
    }

    // 1. Si on a à la fois l'adresse et la commune/ville, combiner les deux pour une précision maximale
    if (cleanAddr && parsedCity) {
      // Essayer adresse + ville combinées
      const combined = `${cleanAddr}, ${parsedCity}`;
      const direct = await this.geocodeQuery(combined);
      if (direct && (direct.score === undefined || direct.score >= 0.55)) {
        return { latitude: direct.latitude, longitude: direct.longitude };
      }

      // Si échec ou score faible, essayer avec biais géographique autour de la ville
      if (cityCoords) {
        const near = await this.geocodeQuery(
          cleanAddr,
          undefined,
          cityCoords.latitude,
          cityCoords.longitude,
        );
        if (near && (near.score === undefined || near.score >= 0.5)) {
          return { latitude: near.latitude, longitude: near.longitude };
        }
        return cityCoords;
      }
    }

    // 2. Si on a seulement l'adresse
    if (cleanAddr) {
      const addrRes = await this.geocodeQuery(cleanAddr);
      if (addrRes) return { latitude: addrRes.latitude, longitude: addrRes.longitude };
    }

    // 3. Si on a seulement la ville/commune
    if (cityCoords) {
      return cityCoords;
    }

    return null;
  }

  async create(createDto: CreateCompanyDto, userId?: string) {
    let lat = createDto.latitude;
    let lon = createDto.longitude;

    if ((lat === undefined || lon === undefined) && (createDto.address || createDto.city)) {
      const geo = await this.geocodeAddress(createDto.address, createDto.city);
      if (geo) {
        lat = geo.latitude;
        lon = geo.longitude;
      }
    }

    const company = await this.prisma.company.create({
      data: {
        name: createDto.name,
        email: createDto.email,
        address: createDto.address,
        city: createDto.city,
        latitude: lat,
        longitude: lon,
        phone: createDto.phone,
        notes: createDto.notes,
        status: createDto.status ?? Status.AUTO_SEND,
        userId: userId ?? undefined,
      },
      include: {
        activities: {
          orderBy: { performedAt: 'desc' },
        },
      },
    });

    await this.recordActivity(
      company.id,
      'CREATION',
      'Création de la fiche',
      `Fiche créée avec le statut : ${company.status}`,
    );

    return company;
  }

  async findAll(query: QueryCompanyDto, userId?: string) {
    const where: Prisma.CompanyWhereInput = {};

    if (userId) {
      where.userId = userId;
    }

    if (query.statuses && query.statuses.length > 0) {
      where.status = { in: query.statuses };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.cities && query.cities.length > 0) {
      where.OR = query.cities.map((c) => ({
        city: { contains: c, mode: 'insensitive' as const },
      }));
    } else if (query.city) {
      where.city = { contains: query.city, mode: 'insensitive' as const };
    }

    if (query.search) {
      const searchOR: Prisma.CompanyWhereInput[] = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { address: { contains: query.search, mode: 'insensitive' as const } },
        { city: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    const allowedSortFields = ['updatedAt', 'name', 'city', 'createdAt', 'status'];
    const sortField =
      query.sortBy && allowedSortFields.includes(query.sortBy)
        ? query.sortBy
        : 'updatedAt';
    const sortDir = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [sortField]: sortDir },
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

  async findOne(id: string, userId?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: { performedAt: 'desc' },
        },
      },
    });

    if (!company || (userId && company.userId && company.userId !== userId)) {
      throw new NotFoundException(`Entreprise avec l'ID ${id} non trouvée`);
    }

    return company;
  }

  async update(id: string, updateDto: UpdateCompanyDto, userId?: string) {
    const existing = await this.findOne(id, userId);

    let lat: number | null | undefined = updateDto.latitude;
    let lon: number | null | undefined = updateDto.longitude;

    const finalAddress = updateDto.address !== undefined ? updateDto.address : existing.address;
    const finalCity = updateDto.city !== undefined ? updateDto.city : existing.city;

    if (
      lat === undefined &&
      lon === undefined &&
      (updateDto.address !== undefined || updateDto.city !== undefined)
    ) {
      const geo = await this.geocodeAddress(finalAddress, finalCity);
      lat = geo ? geo.latitude : null;
      lon = geo ? geo.longitude : null;
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        ...updateDto,
        ...(lat !== undefined ? { latitude: lat } : {}),
        ...(lon !== undefined ? { longitude: lon } : {}),
      },
      include: {
        activities: {
          orderBy: { performedAt: 'desc' },
        },
      },
    });

    await this.recordActivity(
      id,
      'NOTE',
      'Mise à jour des informations',
      'Coordonnées ou notes de l\'entreprise modifiées',
    );

    return updated;
  }

  async updateStatus(id: string, status: Status, userId?: string) {
    const existing = await this.findOne(id, userId);

    const updated = await this.prisma.company.update({
      where: { id },
      data: { status },
      include: {
        activities: {
          orderBy: { performedAt: 'desc' },
        },
      },
    });

    if (existing.status !== status) {
      await this.recordActivity(
        id,
        'STATUS_CHANGE',
        `Changement de statut`,
        `Passage du statut ${existing.status} à ${status}`,
      );
    }

    return updated;
  }

  async remove(id: string, userId?: string) {
    await this.findOne(id, userId);

    return this.prisma.company.delete({
      where: { id },
    });
  }

  async removeBatch(body: { ids?: string[]; all?: boolean }, userId?: string) {
    const where: Prisma.CompanyWhereInput = userId ? { userId } : {};

    if (body.all) {
      const result = await this.prisma.company.deleteMany({
        where,
      });
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
      where: { ...where, id: { in: body.ids } },
    });
    this.logger.log(
      `Suppression groupée : ${result.count} entreprise(s) supprimée(s)`,
    );

    return { deletedCount: result.count };
  }

  async getStats(userId?: string) {
    const groups = (await (this.prisma.company.groupBy as any)({
      by: ['status'],
      where: userId ? { userId } : undefined,
      _count: {
        id: true,
      },
    })) as Array<{ status: Status; _count: { id: number } }>;

    const stats: Record<string, number> = {
      AUTO_SEND: 0,
      TO_SEND: 0,
      WAITING_FOR_REPLY: 0,
      TO_FOLLOW_UP: 0,
      TO_CALL: 0,
      REPLY_RECEIVED: 0,
      REFUSED: 0,
      ACCEPTED: 0,
    };

    for (const group of groups) {
      stats[group.status] = group._count?.id ?? 0;
    }

    return stats;
  }

  async getCities(userId?: string): Promise<Array<{ city: string; count: number }>> {
    const records = await this.prisma.company.findMany({
      where: {
        city: { not: null },
        ...(userId ? { userId } : {}),
      },
      select: {
        city: true,
      },
    });

    const cityCountMap = new Map<string, number>();
    for (const record of records) {
      const trimmed = record.city ? record.city.trim() : '';
      if (trimmed) {
        cityCountMap.set(trimmed, (cityCountMap.get(trimmed) ?? 0) + 1);
      }
    }

    return Array.from(cityCountMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
  }

  private readonly logger = new Logger(CompaniesService.name);

  async importFromSpreadsheet(fileBuffer: Buffer, userId?: string) {
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
        address: -1,
        city: -1,
        postalCode: -1,
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
          address: -1,
          city: -1,
          postalCode: -1,
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
              norm.includes('agence') ||
              norm.includes('etablissement') ||
              norm.includes('client'))
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
            tempMap.address === -1 &&
            (norm.includes('adresse') ||
              norm === 'rue' ||
              norm.includes('voie') ||
              norm.includes('numero'))
          ) {
            tempMap.address = colIdx;
            score += 9;
          } else if (
            tempMap.city === -1 &&
            (norm === 'ville' ||
              norm === 'villes' ||
              norm === 'city' ||
              norm === 'cities' ||
              norm.includes('commune') ||
              norm.includes('localis') ||
              norm.includes('lieu') ||
              norm.includes('secteur') ||
              norm.includes('bassin') ||
              norm.includes('site') ||
              norm.includes('region') ||
              norm.includes('departement') ||
              norm.includes('dep') ||
              norm.includes('cp / ville') ||
              norm.includes('cp/ville') ||
              norm.includes('ville/cp') ||
              norm.includes('ville / cp'))
          ) {
            tempMap.city = colIdx;
            score += 10;
          } else if (
            tempMap.postalCode === -1 &&
            (norm === 'cp' ||
              norm.includes('code postal') ||
              norm.includes('codepostal') ||
              norm.includes('postal'))
          ) {
            tempMap.postalCode = colIdx;
            score += 6;
          } else if (
            tempMap.phone === -1 &&
            (norm.includes('tel') ||
              norm.includes('phone') ||
              norm.includes('mobile') ||
              norm.includes('portable') ||
              norm.includes('fixe') ||
              norm.includes('standard') ||
              norm.includes('contact tel'))
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
              norm.includes('desc') ||
              norm.includes('detail') ||
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
          `nom=${bestColMap.name}, email=${bestColMap.email}, ville=${bestColMap.city}, cp=${bestColMap.postalCode}, tel=${bestColMap.phone}, notes=${bestColMap.notes}, statut=${bestColMap.status}`,
      );

      // Si le nom ou l'email n'a pas été détecté dans l'en-tête, heuristique par contenu
      if (bestColMap.name === -1) {
        for (let c = 0; c < 10; c++) {
          if (c !== bestColMap.email && c !== bestColMap.phone && c !== bestColMap.city) {
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

      // Heuristique pour la ville si non détectée par l'en-tête
      if (bestColMap.city === -1) {
        const FRENCH_ZIP_REGEX = /\b(0[1-9]|[1-8]\d|9[0-8])\d{3}\b/;
        const KNOWN_CITIES_REGEX =
          /\b(paris|lyon|marseille|toulouse|bordeaux|nantes|lille|montpellier|perpignan|beziers|béziers|rennes|strasbourg|nice|nimes|nîmes|grenoble|angers|dijon|toulon|reims|brest|le mans|aix|clermont|tours|amiens|limoges|annecy|metz|besancon|besançon|orleans|orléans|mulhouse|caen|rouen|distanciel|teletravail)\b/i;

        for (
          let i = dataStart;
          i < Math.min(nonEmptyRows.length, dataStart + 15);
          i++
        ) {
          const row = nonEmptyRows[i];
          if (!Array.isArray(row)) continue;
          row.forEach((cell, colIdx) => {
            if (bestColMap.city !== -1) return;
            if (
              colIdx !== bestColMap.name &&
              colIdx !== bestColMap.email &&
              colIdx !== bestColMap.phone
            ) {
              const strVal = String(cell ?? '').trim();
              if (
                FRENCH_ZIP_REGEX.test(strVal) ||
                KNOWN_CITIES_REGEX.test(strVal)
              ) {
                bestColMap.city = colIdx;
              }
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
        let rawAddress =
          bestColMap.address !== -1
            ? String(row[bestColMap.address] ?? '').trim()
            : '';
        let rawCity =
          bestColMap.city !== -1
            ? String(row[bestColMap.city] ?? '').trim()
            : '';
        const rawCp =
          bestColMap.postalCode !== -1
            ? String(row[bestColMap.postalCode] ?? '').trim()
            : '';
        const rawPhone =
          bestColMap.phone !== -1
            ? String(row[bestColMap.phone] ?? '').trim()
            : '';
        const rawStatus =
          bestColMap.status !== -1
            ? String(row[bestColMap.status] ?? '').trim()
            : '';

        // Si la ville et le code postal sont dans 2 colonnes séparées, les combiner
        if (rawCp && rawCity && !rawCity.includes(rawCp)) {
          rawCity = `${rawCp} ${rawCity}`.trim();
        } else if (rawCp && !rawCity) {
          rawCity = rawCp;
        }

        // Si la ville n'a pas été trouvée, ou s'il n'y a que le code postal numérique :
        if (!rawCity || /^\d{4,5}$/.test(rawCity)) {
          for (let colIdx = 0; colIdx < row.length; colIdx++) {
            if (
              colIdx === bestColMap.name ||
              colIdx === bestColMap.email ||
              colIdx === bestColMap.phone
            ) {
              continue;
            }
            const cellStr = String(row[colIdx] ?? '').trim();
            if (!cellStr) continue;

            const colHeader =
              headerRow && headerRow[colIdx]
                ? normalizeStr(headerRow[colIdx])
                : '';
            const isLocationHeader =
              colHeader.includes('commune') ||
              colHeader.includes('ville') ||
              colHeader.includes('city') ||
              colHeader.includes('localis') ||
              colHeader.includes('lieu') ||
              colHeader.includes('secteur') ||
              colHeader.includes('adresse');

            if (isLocationHeader && cellStr && cellStr !== rawCity) {
              if (rawCity && /^\d{4,5}$/.test(rawCity)) {
                rawCity = `${rawCity} ${cellStr}`.trim();
              } else {
                rawCity = cellStr;
              }
              break;
            }
          }
        }

        // Récupérer TOUTES les autres données du tableur dans les notes pour ne RIEN perdre
        const extraDataList: string[] = [];
        row.forEach((cellVal, colIdx) => {
          if (
            colIdx === bestColMap.name ||
            colIdx === bestColMap.email ||
            colIdx === bestColMap.phone ||
            colIdx === bestColMap.status
          ) {
            return;
          }

          const valStr = String(cellVal ?? '').trim();
          if (!valStr) return;

          // Si la valeur est déjà la ville ou le CP extrait, ne pas la répéter dans les notes
          if (rawCity && (rawCity === valStr || rawCity.includes(valStr))) {
            const colHeader =
              headerRow && headerRow[colIdx]
                ? normalizeStr(headerRow[colIdx])
                : '';
            if (
              colHeader.includes('ville') ||
              colHeader.includes('commune') ||
              colHeader.includes('cp') ||
              colHeader.includes('postal') ||
              colHeader.includes('localis')
            ) {
              return;
            }
          }

          const colHeaderName =
            headerRow && headerRow[colIdx]
              ? String(headerRow[colIdx] ?? '').trim()
              : '';

          if (colHeaderName) {
            extraDataList.push(`${colHeaderName}: ${valStr}`);
          } else {
            extraDataList.push(valStr);
          }
        });

        let rawNotes = extraDataList.join('\n');

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
              idx !== bestColMap.phone &&
              idx !== bestColMap.city
            );
          });
          if (nameCell) {
            rawName = String(nameCell).trim();
          }
        }

        // Si le nom est toujours vide, mettre une valeur par défaut au lieu de rejeter la ligne
        if (!rawName) {
          rawName = `Entreprise ${rowNum}`;
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

          if (colVal && !isExplicitEmailCol) {
            rawNotes = rawNotes
              ? `${rawNotes}\n[Contact: ${colVal}]`
              : `[Contact: ${colVal}]`;
          } else if (colVal && isExplicitEmailCol) {
            rawNotes = rawNotes
              ? `${rawNotes}\n[Email brut: ${colVal}]`
              : `[Email brut: ${colVal}]`;
          }

          // Attribution d'une adresse de secours unique pour ne jamais rejeter la ligne
          const slug =
            rawName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, '')
              .slice(0, 15) || 'entreprise';
          rawEmail = `${slug}.${rowNum}@sans-email.altertrack`;
          rawNotes = rawNotes
            ? `${rawNotes}\n[Email à renseigner]`
            : '[Email à renseigner]';
        }

        // Prise en charge intégrale des doublons :
        // Si une fiche existe déjà avec exactement le même nom ET le même email dans la base, la mettre à jour
        const rowKey = `${rawName}:::${rawEmail}`;
        let isUpdated = false;

        if (!seenEmailsInBatch.has(rowKey)) {
          const existing = await this.prisma.company.findFirst({
            where: { name: rawName, email: rawEmail },
          });

          if (existing) {
            const updated = await this.prisma.company.update({
              where: { id: existing.id },
              data: {
                address: rawAddress || existing.address || null,
                city: rawCity || existing.city || null,
                phone: rawPhone || existing.phone || null,
                notes: rawNotes || existing.notes || null,
              },
            });
            imported.push({
              id: updated.id,
              name: updated.name,
              email: updated.email,
              city: updated.city,
              status: updated.status,
            });
            seenEmailsInBatch.add(rowKey);
            isUpdated = true;
          }
        }

        if (isUpdated) {
          continue;
        }

        seenEmailsInBatch.add(rowKey);

        // Résolution intelligente du statut
        let parsedStatus: Status = Status.AUTO_SEND;
        if (rawStatus) {
          const s = normalizeStr(rawStatus);
          if (
            s.includes('auto') ||
            s.includes('auto_send') ||
            s.includes('envoi auto')
          ) {
            parsedStatus = Status.AUTO_SEND;
          } else if (
            s.includes('manuel') ||
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

        // Géocodage automatique à l'import combinant adresse ET commune/ville
        let importLat: number | null = null;
        let importLon: number | null = null;
        if (rawAddress || rawCity) {
          const geo = await this.geocodeAddress(rawAddress, rawCity);
          if (geo) {
            importLat = geo.latitude;
            importLon = geo.longitude;
          }
        }

        // Enregistrement en base de données
        const created = await this.prisma.company.create({
          data: {
            name: rawName,
            email: rawEmail,
            address: rawAddress || null,
            city: rawCity || null,
            latitude: importLat,
            longitude: importLon,
            phone: rawPhone || null,
            notes: rawNotes || null,
            status: parsedStatus,
          },
        });

        await this.recordActivity(
          created.id,
          'CREATION',
          'Importation de la fiche',
          `Entreprise importée avec le statut : ${created.status}`,
        );

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

  async recordActivity(
    companyId: string,
    type: string,
    title: string,
    description?: string,
    performedAt?: Date,
    metadata?: string,
  ) {
    try {
      return await this.prisma.companyActivity.create({
        data: {
          companyId,
          type,
          title,
          description: description || null,
          performedAt: performedAt || new Date(),
          metadata: metadata || null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Impossible d'enregistrer l'activité pour ${companyId}: ${String(err)}`,
      );
      return null;
    }
  }

  async addActivity(
    companyId: string,
    dto: CreateActivityDto,
    userId?: string,
  ) {
    await this.findOne(companyId, userId);

    const performedAt = dto.performedAt
      ? new Date(dto.performedAt)
      : new Date();

    return this.prisma.companyActivity.create({
      data: {
        companyId,
        type: dto.type || 'CUSTOM',
        title: dto.title,
        description: dto.description || null,
        performedAt: isNaN(performedAt.getTime()) ? new Date() : performedAt,
        metadata: dto.metadata || null,
      },
    });
  }

  async getActivities(companyId: string, userId?: string) {
    const company = await this.findOne(companyId, userId);

    let activities = await this.prisma.companyActivity.findMany({
      where: { companyId },
      orderBy: { performedAt: 'desc' },
    });

    if (activities.length === 0) {
      const initialActivities: Array<{
        companyId: string;
        type: string;
        title: string;
        description: string;
        performedAt: Date;
      }> = [];

      initialActivities.push({
        companyId,
        type: 'CREATION',
        title: 'Création de la fiche',
        description: 'Entreprise ajoutée à AlterTrack',
        performedAt: company.createdAt,
      });

      if (company.firstMailSentAt) {
        initialActivities.push({
          companyId,
          type: 'EMAIL_SENT',
          title: 'Candidature envoyée',
          description: `Premier email de candidature expédié à ${company.email}`,
          performedAt: company.firstMailSentAt,
        });
      }

      if (company.followUpSentAt) {
        initialActivities.push({
          companyId,
          type: 'FOLLOW_UP_SENT',
          title: 'Relance effectuée',
          description: `Email de relance expédié à ${company.email}`,
          performedAt: company.followUpSentAt,
        });
      }

      for (const act of initialActivities) {
        await this.prisma.companyActivity.create({ data: act });
      }

      activities = await this.prisma.companyActivity.findMany({
        where: { companyId },
        orderBy: { performedAt: 'desc' },
      });
    }

    return activities;
  }

  async updateActivity(
    companyId: string,
    activityId: string,
    dto: UpdateActivityDto,
    userId?: string,
  ) {
    await this.findOne(companyId, userId);

    const activity = await this.prisma.companyActivity.findFirst({
      where: { id: activityId, companyId },
    });

    if (!activity) {
      throw new NotFoundException(`Activité ${activityId} non trouvée`);
    }

    const data: Prisma.CompanyActivityUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.metadata !== undefined) data.metadata = dto.metadata;
    if (dto.performedAt) data.performedAt = new Date(dto.performedAt);

    return this.prisma.companyActivity.update({
      where: { id: activityId },
      data,
    });
  }

  async deleteActivity(
    companyId: string,
    activityId: string,
    userId?: string,
  ) {
    await this.findOne(companyId, userId);

    const activity = await this.prisma.companyActivity.findFirst({
      where: { id: activityId, companyId },
    });

    if (!activity) {
      throw new NotFoundException(`Activité ${activityId} non trouvée`);
    }

    return this.prisma.companyActivity.delete({
      where: { id: activityId },
    });
  }
}

