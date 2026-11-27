import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Company, Prisma, Status } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  private static readonly cityCache = new Map<
    string,
    { latitude: number; longitude: number }
  >();

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
        typeof lat === 'number' && typeof lon === 'number'
          ? `&lat=${lat}&lon=${lon}`
          : '';
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(queryText.trim())}${typeParam}${proxParam}&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        features?: Array<{
          properties?: {
            score?: number;
            type?: string;
            city?: string;
            name?: string;
          };
          geometry: { coordinates: [number, number] };
        }>;
      };
      if (data.features && data.features.length > 0) {
        const feat = data.features[0];
        const [featLon, featLat] = feat.geometry.coordinates;
        return {
          latitude: featLat,
          longitude: featLon,
          score: feat.properties?.score,
        };
      }
    } catch {
      // Ignorer silencieusement si API inaccessible
    }
    return null;
  }

  /**
   * Géocode en combinant l'adresse ET la ville / commune avec validation stricte
   */
  async geocodeAddress(
    address?: string | null,
    city?: string | null,
  ): Promise<{ latitude: number; longitude: number } | null> {
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
    const parsedCity = cleanCity ? cleanCity.split(/[/,]/)[0].trim() : '';

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
      if (addrRes)
        return { latitude: addrRes.latitude, longitude: addrRes.longitude };
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

    if (
      (lat === undefined || lon === undefined) &&
      (createDto.address || createDto.city)
    ) {
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
      where.OR = [{ userId }, { userId: null }];
    }

    if (query.statuses && query.statuses.length > 0) {
      where.status = { in: query.statuses };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.cities && query.cities.length > 0) {
      const cityOR = query.cities.map((c) => ({
        city: { contains: c, mode: 'insensitive' as const },
      }));
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: cityOR }];
        delete where.OR;
      } else {
        where.OR = cityOR;
      }
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
        where.AND = [
          ...((where.AND as any[]) || []),
          { OR: where.OR },
          { OR: searchOR },
        ];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    const allowedSortFields = [
      'updatedAt',
      'name',
      'city',
      'createdAt',
      'status',
    ];
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

    const finalAddress =
      updateDto.address !== undefined ? updateDto.address : existing.address;
    const finalCity =
      updateDto.city !== undefined ? updateDto.city : existing.city;

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
      "Coordonnées ou notes de l'entreprise modifiées",
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
      where: userId ? { OR: [{ userId }, { userId: null }] } : undefined,
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

  async getCities(
    userId?: string,
  ): Promise<Array<{ city: string; count: number }>> {
    const records = await this.prisma.company.findMany({
      where: {
        city: { not: null },
        ...(userId ? { OR: [{ userId }, { userId: null }] } : {}),
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

  private safeString(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return '';
  }

  normalizeStr(val: unknown): string {
    return this.safeString(val)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  parseCoordinate(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') {
      return isNaN(val) ? null : val;
    }
    const str = this.safeString(val).replace(',', '.').trim();
    if (!str) return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  parseDate(val: unknown): Date | null {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    const str = this.safeString(val).trim();
    if (!str) return null;

    // Numéro de série Excel (ex: 45363 ou 45363.4166666667)
    if (
      typeof val === 'number' ||
      (/^\d+(\.\d+)?$/.test(str) && Number(str) > 10000 && Number(str) < 100000)
    ) {
      const num = Number(str);
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      return isNaN(date.getTime()) ? null : date;
    }

    // Format français DD/MM/YYYY HH:mm ou DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY
    const frMatch = str.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
    );
    if (frMatch) {
      const day = parseInt(frMatch[1], 10);
      const month = parseInt(frMatch[2], 10) - 1;
      const year = parseInt(frMatch[3], 10);
      const hour = frMatch[4] ? parseInt(frMatch[4], 10) : 0;
      const minute = frMatch[5] ? parseInt(frMatch[5], 10) : 0;
      const second = frMatch[6] ? parseInt(frMatch[6], 10) : 0;
      const d = new Date(year, month, day, hour, minute, second);
      return isNaN(d.getTime()) ? null : d;
    }

    // Format ISO ou standard Date JS
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  }

  desanitize(val: unknown): string {
    if (val === null || val === undefined) return '';
    const str = this.safeString(val).trim();
    if (str.startsWith("'") && /^[=+\-@\t\r]/.test(str.slice(1))) {
      return str.slice(1);
    }
    return str;
  }

  parseStatus(raw: string): Status {
    const s = this.normalizeStr(raw);
    if (!s) return Status.AUTO_SEND;
    if (s.includes('auto') || s === 'auto_send') {
      return Status.AUTO_SEND;
    }
    if (
      s.includes('manuel') ||
      s.includes('a envoyer') ||
      s.includes('to_send') ||
      s.includes('to send') ||
      s === 'nouveau' ||
      s === 'brouillon'
    ) {
      return Status.TO_SEND;
    }
    if (
      s.includes('attente') ||
      s.includes('waiting') ||
      s.includes('envoye') ||
      s.includes('sent')
    ) {
      return Status.WAITING_FOR_REPLY;
    }
    if (s.includes('relanc') || s.includes('follow')) {
      return Status.TO_FOLLOW_UP;
    }
    if (s.includes('appel') || s.includes('call')) {
      return Status.TO_CALL;
    }
    if (s.includes('repon') || s.includes('reply')) {
      return Status.REPLY_RECEIVED;
    }
    if (s.includes('refus') || s.includes('rejet')) {
      return Status.REFUSED;
    }
    if (
      s.includes('accept') ||
      s.includes('positif') ||
      s.includes('entretien')
    ) {
      return Status.ACCEPTED;
    }
    return Status.AUTO_SEND;
  }

  async restoreActivitiesFromText(companyId: string, text: string) {
    if (!text || !text.trim()) return;
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^\[(.*?)\]\s*([^:]+?)(?:\s*:\s*(.*))?$/);
      let actDate = new Date();
      let actTitle = line;
      let actDesc: string | null = null;
      if (match) {
        const parsedD = this.parseDate(match[1]);
        if (parsedD) actDate = parsedD;
        actTitle = match[2].trim();
        actDesc = match[3] ? match[3].trim() : null;
      }
      const existing = await this.prisma.companyActivity.findFirst({
        where: {
          companyId,
          title: actTitle,
          performedAt: actDate,
        },
      });
      if (!existing) {
        await this.prisma.companyActivity.create({
          data: {
            companyId,
            type: 'IMPORT',
            title: actTitle,
            description: actDesc,
            performedAt: actDate,
          },
        });
      }
    }
  }

  async importFromSpreadsheet(fileBuffer: Buffer, userId?: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Le fichier reçu est vide (0 octet)');
    }

    // Supprimer le BOM UTF-8 (0xEF, 0xBB, 0xBF) s'il est présent au début du fichier
    let cleanBuffer = fileBuffer;
    if (
      cleanBuffer.length >= 3 &&
      cleanBuffer[0] === 0xef &&
      cleanBuffer[1] === 0xbb &&
      cleanBuffer[2] === 0xbf
    ) {
      cleanBuffer = cleanBuffer.subarray(3);
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(cleanBuffer, {
        type: 'buffer',
        cellFormula: true,
        raw: true,
        codepage: 65001,
      });
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
    const skippedCount = 0;
    let totalDetectedRows = 0;

    const normalizeStr = (val: unknown): string => this.normalizeStr(val);

    // Parcourir toutes les feuilles du classeur pour ne rien rater
    for (const sheetName of workbook.SheetNames) {
      const normSheet = normalizeStr(sheetName);
      // Ignorer la feuille dédiée aux activités qui sera traitée après
      if (normSheet === 'activites' || normSheet === 'activities') {
        continue;
      }

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
        id: -1,
        name: -1,
        email: -1,
        phone: -1,
        address: -1,
        city: -1,
        postalCode: -1,
        status: -1,
        latitude: -1,
        longitude: -1,
        notes: -1,
        firstMailSentAt: -1,
        followUpReadyAt: -1,
        followUpSentAt: -1,
        lastMailId: -1,
        createdAt: -1,
        updatedAt: -1,
        activitiesCount: -1,
        activities: -1,
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
          id: -1,
          name: -1,
          email: -1,
          phone: -1,
          address: -1,
          city: -1,
          postalCode: -1,
          status: -1,
          latitude: -1,
          longitude: -1,
          notes: -1,
          firstMailSentAt: -1,
          followUpReadyAt: -1,
          followUpSentAt: -1,
          lastMailId: -1,
          createdAt: -1,
          updatedAt: -1,
          activitiesCount: -1,
          activities: -1,
        };

        row.forEach((cell, colIdx) => {
          const norm = normalizeStr(cell);
          if (!norm) return;

          if (
            tempMap.id === -1 &&
            (norm === 'id' || norm === 'identifiant' || norm === 'uuid')
          ) {
            tempMap.id = colIdx;
            score += 10;
          } else if (
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
              norm.includes('adresse electronique')) &&
            !norm.includes('premier') &&
            !norm.includes('dernier') &&
            !norm.includes('envoi')
          ) {
            tempMap.email = colIdx;
            score += 10;
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
            tempMap.address === -1 &&
            (norm.includes('adresse') ||
              norm === 'rue' ||
              norm.includes('voie') ||
              norm.includes('numero')) &&
            !norm.includes('electronique') &&
            !norm.includes('mail')
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
            tempMap.status === -1 &&
            (norm.includes('statut') ||
              norm.includes('status') ||
              norm.includes('code statut') ||
              norm.includes('etat') ||
              norm.includes('phase') ||
              norm.includes('avancement') ||
              norm.includes('suivi'))
          ) {
            tempMap.status = colIdx;
            score += 5;
          } else if (
            tempMap.latitude === -1 &&
            (norm === 'latitude' || norm === 'lat')
          ) {
            tempMap.latitude = colIdx;
            score += 5;
          } else if (
            tempMap.longitude === -1 &&
            (norm === 'longitude' ||
              norm === 'lon' ||
              norm === 'lng' ||
              norm === 'long')
          ) {
            tempMap.longitude = colIdx;
            score += 5;
          } else if (
            tempMap.firstMailSentAt === -1 &&
            (norm.includes('firstmail') ||
              (norm.includes('premier') &&
                (norm.includes('mail') || norm.includes('envoi'))))
          ) {
            tempMap.firstMailSentAt = colIdx;
            score += 5;
          } else if (
            tempMap.followUpReadyAt === -1 &&
            (norm.includes('followupready') ||
              (norm.includes('relance') &&
                (norm.includes('prevu') ||
                  norm.includes('prévu') ||
                  norm.includes('ready'))))
          ) {
            tempMap.followUpReadyAt = colIdx;
            score += 5;
          } else if (
            tempMap.followUpSentAt === -1 &&
            (norm.includes('followupsent') ||
              (norm.includes('relance') &&
                (norm.includes('envoy') ||
                  norm.includes('envoyé') ||
                  norm.includes('sent'))))
          ) {
            tempMap.followUpSentAt = colIdx;
            score += 5;
          } else if (
            tempMap.lastMailId === -1 &&
            (norm.includes('lastmail') ||
              (norm.includes('dernier') &&
                (norm.includes('id') || norm.includes('mail'))))
          ) {
            tempMap.lastMailId = colIdx;
            score += 5;
          } else if (
            tempMap.createdAt === -1 &&
            (norm.includes('createdat') ||
              norm.includes('date de creation') ||
              norm.includes("date d'ajout") ||
              norm.includes('date d’ajout') ||
              norm.includes('date creation'))
          ) {
            tempMap.createdAt = colIdx;
            score += 5;
          } else if (
            tempMap.updatedAt === -1 &&
            (norm.includes('updatedat') ||
              norm.includes('mise a jour') ||
              norm.includes('mise à jour') ||
              norm.includes('date de mise a jour') ||
              norm.includes('date modification'))
          ) {
            tempMap.updatedAt = colIdx;
            score += 5;
          } else if (
            tempMap.activitiesCount === -1 &&
            norm.includes('nombre') &&
            norm.includes('activit')
          ) {
            tempMap.activitiesCount = colIdx;
            score += 3;
          } else if (
            tempMap.activities === -1 &&
            (norm.includes('activit') || norm.includes('historique')) &&
            !norm.includes('nombre')
          ) {
            tempMap.activities = colIdx;
            score += 5;
          } else if (
            tempMap.notes === -1 &&
            (norm.includes('note') ||
              norm.includes('comm') ||
              norm.includes('remarqu') ||
              norm.includes('detail') ||
              norm.includes('info')) &&
            !norm.includes('activit') &&
            !norm.includes('premier') &&
            !norm.includes('relance') &&
            !norm.includes('dernier')
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
          `nom=${bestColMap.name}, email=${bestColMap.email}, ville=${bestColMap.city}, cp=${bestColMap.postalCode}, tel=${bestColMap.phone}, statut=${bestColMap.status}, lat=${bestColMap.latitude}, lon=${bestColMap.longitude}, notes=${bestColMap.notes}`,
      );

      // Si le nom ou l'email n'a pas été détecté dans l'en-tête, heuristique par contenu
      if (bestColMap.name === -1) {
        for (let c = 0; c < 10; c++) {
          if (
            c !== bestColMap.email &&
            c !== bestColMap.phone &&
            c !== bestColMap.city
          ) {
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

      const isKnownCol = (colIdx: number) => {
        return (
          colIdx === bestColMap.id ||
          colIdx === bestColMap.name ||
          colIdx === bestColMap.email ||
          colIdx === bestColMap.phone ||
          colIdx === bestColMap.address ||
          colIdx === bestColMap.city ||
          colIdx === bestColMap.postalCode ||
          colIdx === bestColMap.latitude ||
          colIdx === bestColMap.longitude ||
          colIdx === bestColMap.status ||
          colIdx === bestColMap.notes ||
          colIdx === bestColMap.firstMailSentAt ||
          colIdx === bestColMap.followUpReadyAt ||
          colIdx === bestColMap.followUpSentAt ||
          colIdx === bestColMap.lastMailId ||
          colIdx === bestColMap.createdAt ||
          colIdx === bestColMap.updatedAt ||
          colIdx === bestColMap.activities ||
          colIdx === bestColMap.activitiesCount
        );
      };

      // 2. Extraction et validation des lignes de données
      for (let i = dataStart; i < nonEmptyRows.length; i++) {
        const row = nonEmptyRows[i];
        if (!Array.isArray(row) || row.every((c) => !String(c ?? '').trim())) {
          continue;
        }

        totalDetectedRows++;
        const originalRowIdx = nonEmptyRowIndices[i] ?? i;
        const rowNum = originalRowIdx + 1;

        const rawId =
          bestColMap.id !== -1
            ? this.desanitize(row[bestColMap.id]).trim()
            : '';
        let rawName =
          bestColMap.name !== -1
            ? this.desanitize(row[bestColMap.name]).trim()
            : '';
        let rawEmail = '';
        const rawAddress =
          bestColMap.address !== -1
            ? this.desanitize(row[bestColMap.address]).trim()
            : '';
        let rawCity =
          bestColMap.city !== -1
            ? this.desanitize(row[bestColMap.city]).trim()
            : '';
        const rawCp =
          bestColMap.postalCode !== -1
            ? this.desanitize(row[bestColMap.postalCode]).trim()
            : '';
        let rawPhone =
          bestColMap.phone !== -1
            ? this.desanitize(row[bestColMap.phone]).trim()
            : '';
        // Si le numéro a perdu son 0 initial suite au typage numérique Excel/CSV (9 chiffres au lieu de 10)
        if (/^[1-9]\d{8}$/.test(rawPhone)) {
          rawPhone = `0${rawPhone}`;
        }
        const rawStatus =
          bestColMap.status !== -1
            ? this.desanitize(row[bestColMap.status]).trim()
            : '';

        const parsedLat =
          bestColMap.latitude !== -1
            ? this.parseCoordinate(row[bestColMap.latitude])
            : null;
        const parsedLon =
          bestColMap.longitude !== -1
            ? this.parseCoordinate(row[bestColMap.longitude])
            : null;

        const parsedFirstMailSentAt =
          bestColMap.firstMailSentAt !== -1
            ? this.parseDate(row[bestColMap.firstMailSentAt])
            : null;
        const parsedFollowUpReadyAt =
          bestColMap.followUpReadyAt !== -1
            ? this.parseDate(row[bestColMap.followUpReadyAt])
            : null;
        const parsedFollowUpSentAt =
          bestColMap.followUpSentAt !== -1
            ? this.parseDate(row[bestColMap.followUpSentAt])
            : null;
        const rawLastMailId =
          bestColMap.lastMailId !== -1
            ? this.desanitize(row[bestColMap.lastMailId]).trim()
            : '';

        const parsedCreatedAt =
          bestColMap.createdAt !== -1
            ? this.parseDate(row[bestColMap.createdAt])
            : null;

        const rawActivities =
          bestColMap.activities !== -1
            ? this.desanitize(row[bestColMap.activities]).trim()
            : '';

        const rawNotes =
          bestColMap.notes !== -1
            ? this.desanitize(row[bestColMap.notes]).trim()
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

        // Colonnes personnalisées non reconnues à préserver dans les notes
        const extraDataList: string[] = [];
        row.forEach((cellVal, colIdx) => {
          if (isKnownCol(colIdx)) {
            return;
          }

          const valStr = this.desanitize(cellVal).trim();
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

        let finalNotes = rawNotes;
        if (extraDataList.length > 0) {
          finalNotes = finalNotes
            ? `${finalNotes}\n${extraDataList.join('\n')}`
            : extraDataList.join('\n');
        }

        // Recherche de l'e-mail dans la colonne désignée (texte ou lien hypertexte Excel)
        if (bestColMap.email !== -1) {
          const cellVal = row[bestColMap.email];
          const cellAddr = XLSX.utils.encode_cell({
            r: originalRowIdx,
            c: bestColMap.email,
          });
          const cellObj = worksheet[cellAddr] as
            { l?: { Target?: string } } | undefined;

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
              { l?: { Target?: string } } | undefined;
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
            finalNotes = finalNotes
              ? `${finalNotes}\n[Contact: ${colVal}]`
              : `[Contact: ${colVal}]`;
          } else if (colVal && isExplicitEmailCol) {
            finalNotes = finalNotes
              ? `${finalNotes}\n[Email brut: ${colVal}]`
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
          finalNotes = finalNotes
            ? `${finalNotes}\n[Email à renseigner]`
            : '[Email à renseigner]';
        }

        const parsedStatus = this.parseStatus(rawStatus);

        // Géocodage automatique à l'import combinant adresse ET commune/ville si pas de coordonnées
        let importLat = parsedLat;
        let importLon = parsedLon;
        if (
          (importLat === null || importLon === null) &&
          (rawAddress || rawCity)
        ) {
          const geo = await this.geocodeAddress(rawAddress, rawCity);
          if (geo) {
            importLat = geo.latitude;
            importLon = geo.longitude;
          }
        }

        // Détection fiche existante : par ID (si présent) ou par Nom + Email
        const rowKey = rawId ? `id:${rawId}` : `${rawName}:::${rawEmail}`;
        let existing: Company | null = null;

        if (!seenEmailsInBatch.has(rowKey)) {
          if (rawId) {
            existing = await this.prisma.company.findFirst({
              where: { id: rawId, ...(userId ? { userId } : {}) },
            });
          }
          if (!existing) {
            existing = await this.prisma.company.findFirst({
              where: {
                name: rawName,
                email: rawEmail,
                ...(userId ? { userId } : {}),
              },
            });
          }
        }

        if (existing) {
          const updated = await this.prisma.company.update({
            where: { id: existing.id },
            data: {
              name: rawName,
              email: rawEmail,
              address: rawAddress !== '' ? rawAddress : existing.address,
              city: rawCity !== '' ? rawCity : existing.city,
              phone: rawPhone !== '' ? rawPhone : existing.phone,
              status: rawStatus ? parsedStatus : existing.status,
              latitude: importLat !== null ? importLat : existing.latitude,
              longitude: importLon !== null ? importLon : existing.longitude,
              notes: finalNotes !== '' ? finalNotes : existing.notes,
              firstMailSentAt:
                parsedFirstMailSentAt !== null
                  ? parsedFirstMailSentAt
                  : existing.firstMailSentAt,
              followUpReadyAt:
                parsedFollowUpReadyAt !== null
                  ? parsedFollowUpReadyAt
                  : existing.followUpReadyAt,
              followUpSentAt:
                parsedFollowUpSentAt !== null
                  ? parsedFollowUpSentAt
                  : existing.followUpSentAt,
              lastMailId:
                rawLastMailId !== '' ? rawLastMailId : existing.lastMailId,
              ...(userId ? { userId } : {}),
            },
          });

          if (rawActivities) {
            await this.restoreActivitiesFromText(updated.id, rawActivities);
          }

          imported.push({
            id: updated.id,
            name: updated.name,
            email: updated.email,
            city: updated.city,
            status: updated.status,
          });
          seenEmailsInBatch.add(rowKey);
          continue;
        }

        seenEmailsInBatch.add(rowKey);

        // Si pas de statut explicite et email fallback avec tel, suggérer "À appeler"
        let statusToCreate = parsedStatus;
        if (!rawStatus) {
          if (
            rawEmail.endsWith('@sans-email.altertrack') &&
            rawPhone.length > 0
          ) {
            statusToCreate = Status.TO_CALL;
          } else {
            statusToCreate = Status.AUTO_SEND;
          }
        }

        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            rawId,
          );
        let idToUse: string | undefined = undefined;
        if (isUuid) {
          const idExists = await this.prisma.company.findUnique({
            where: { id: rawId },
          });
          if (!idExists) {
            idToUse = rawId;
          }
        }

        // Enregistrement en base de données
        const created = await this.prisma.company.create({
          data: {
            ...(idToUse ? { id: idToUse } : {}),
            name: rawName,
            email: rawEmail,
            address: rawAddress || null,
            city: rawCity || null,
            latitude: importLat,
            longitude: importLon,
            phone: rawPhone || null,
            notes: finalNotes || null,
            status: statusToCreate,
            firstMailSentAt: parsedFirstMailSentAt,
            followUpReadyAt: parsedFollowUpReadyAt,
            followUpSentAt: parsedFollowUpSentAt,
            lastMailId: rawLastMailId || null,
            ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
            userId: userId || null,
          },
        });

        if (rawActivities) {
          await this.restoreActivitiesFromText(created.id, rawActivities);
        } else {
          await this.recordActivity(
            created.id,
            'CREATION',
            'Importation de la fiche',
            `Entreprise importée avec le statut : ${created.status}`,
          );
        }

        imported.push({
          id: created.id,
          name: created.name,
          email: created.email,
          city: created.city,
          status: created.status,
        });
      }
    }

    // 3. Traiter la feuille Activités si présente dans le classeur
    const actSheetName = workbook.SheetNames.find((s) => {
      const norm = normalizeStr(s);
      return norm === 'activites' || norm === 'activities';
    });

    if (actSheetName) {
      const actSheet = workbook.Sheets[actSheetName];
      if (actSheet) {
        const rawActRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          actSheet,
          { defval: '' },
        );
        for (const actRow of rawActRows) {
          const companyId = this.safeString(
            actRow['ID Entreprise'] ?? actRow['companyId'] ?? '',
          ).trim();
          const actTitle = this.safeString(
            actRow['Titre'] ?? actRow['title'] ?? '',
          ).trim();
          const actDesc =
            this.safeString(
              actRow['Description'] ?? actRow['description'] ?? '',
            ).trim() || null;
          const actType =
            this.safeString(
              actRow['Type'] ?? actRow['type'] ?? 'CUSTOM',
            ).trim() || 'CUSTOM';
          const dateVal =
            actRow['Date de réalisation'] ?? actRow['performedAt'] ?? '';
          const actDate = this.parseDate(dateVal) || new Date();

          if (companyId && actTitle) {
            const targetComp = await this.prisma.company.findFirst({
              where: { id: companyId, ...(userId ? { userId } : {}) },
            });
            if (targetComp) {
              const existingAct = await this.prisma.companyActivity.findFirst({
                where: {
                  companyId: targetComp.id,
                  title: actTitle,
                  performedAt: actDate,
                },
              });
              if (!existingAct) {
                await this.prisma.companyActivity.create({
                  data: {
                    companyId: targetComp.id,
                    type: actType,
                    title: actTitle,
                    description: actDesc,
                    performedAt: actDate,
                  },
                });
              }
            }
          }
        }
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

  async deleteActivity(companyId: string, activityId: string, userId?: string) {
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

  /**
   * Exporte l'intégralité des entreprises de l'utilisateur dans un fichier tableur (.xlsx ou .csv)
   * avec l'ensemble des données associées (coordonnées, statuts, dates, notes, activités).
   * Protégé contre l'injection de formules (CWE-1236).
   */
  async exportToSpreadsheet(userId?: string, format: string = 'xlsx') {
    const whereClause: Prisma.CompanyWhereInput = userId ? { userId } : {};

    const companies = await this.prisma.company.findMany({
      where: whereClause,
      include: {
        activities: {
          orderBy: { performedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatDate = (d: Date | null | undefined): string => {
      if (!d) return '';
      const date = new Date(d);
      if (isNaN(date.getTime())) return '';
      const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    // Assainissement anti-injection de formules CSV/Excel (CWE-1236)
    const sanitize = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = this.safeString(val).trim();
      if (/^[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
      }
      return str;
    };

    const rows = companies.map((c) => {
      // Concaténation chronologique de l'historique complet des activités
      const activitiesText = (c.activities || [])
        .map((act) => {
          const actDate = formatDate(act.performedAt);
          const actTitle = act.title || act.type;
          const actDesc = act.description ? ` : ${act.description}` : '';
          return `[${actDate}] ${actTitle}${actDesc}`;
        })
        .join('\n');

      return {
        ID: sanitize(c.id),
        'Nom de l’entreprise': sanitize(c.name),
        Email: sanitize(c.email),
        Téléphone: sanitize(c.phone || ''),
        Adresse: sanitize(c.address || ''),
        Ville: sanitize(c.city || ''),
        Statut: sanitize(c.status),
        Latitude: typeof c.latitude === 'number' ? c.latitude : '',
        Longitude: typeof c.longitude === 'number' ? c.longitude : '',
        Notes: sanitize(c.notes || ''),
        'Premier e-mail envoyé le': formatDate(c.firstMailSentAt),
        'Relance prévue le': formatDate(c.followUpReadyAt),
        'Relance envoyée le': formatDate(c.followUpSentAt),
        'Dernier ID e-mail': sanitize(c.lastMailId || ''),
        'Date de création': formatDate(c.createdAt),
        'Dernière mise à jour': formatDate(c.updatedAt),
        'Historique des activités': sanitize(activitiesText),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Ajustement dynamique de la largeur des colonnes
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const colWidths = headers.map((key) => {
        let maxLen = key.length;
        for (const row of rows) {
          const val = this.safeString((row as Record<string, unknown>)[key]);
          const firstLine = val.split('\n')[0];
          if (firstLine.length > maxLen) maxLen = firstLine.length;
        }
        return { wch: Math.min(Math.max(maxLen + 3, 14), 50) };
      });
      worksheet['!cols'] = colWidths;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entreprises');

    const cleanFormat = (format || 'xlsx').toLowerCase().trim();
    const dateStamp = new Date().toISOString().slice(0, 10);

    // Ajouter la feuille Activités si export Excel .xlsx
    if (cleanFormat !== 'csv') {
      const actRows: Array<Record<string, unknown>> = [];
      for (const c of companies) {
        for (const act of c.activities || []) {
          actRows.push({
            'ID Activité': sanitize(act.id),
            'ID Entreprise': sanitize(c.id),
            'Nom de l’entreprise': sanitize(c.name),
            Type: sanitize(act.type),
            Titre: sanitize(act.title),
            Description: sanitize(act.description || ''),
            'Date de réalisation': formatDate(act.performedAt),
          });
        }
      }
      if (actRows.length > 0) {
        const actWorksheet = XLSX.utils.json_to_sheet(actRows);
        XLSX.utils.book_append_sheet(workbook, actWorksheet, 'Activités');
      }
    }

    if (cleanFormat === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
      // Ajout du BOM UTF-8 (\uFEFF) pour compatibilité Excel FR native
      const buffer = Buffer.from('\uFEFF' + csvContent, 'utf-8');
      return {
        buffer,
        contentType: 'text/csv; charset=utf-8',
        filename: `altertrack_entreprises_${dateStamp}.csv`,
        count: companies.length,
      };
    }

    const xlsxBuffer: Buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;
    return {
      buffer: Buffer.isBuffer(xlsxBuffer)
        ? xlsxBuffer
        : Buffer.from(xlsxBuffer),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `altertrack_entreprises_${dateStamp}.xlsx`,
      count: companies.length,
    };
  }
}
