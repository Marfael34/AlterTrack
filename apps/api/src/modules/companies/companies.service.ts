import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
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
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
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
}
