import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { buildStandardCvFileName } from '../app-config/app-config.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private sanitizeUser(user: {
    id: string;
    email: string;
    fullName: string;
    gmailUser?: string | null;
    gmailAppPassword?: string | null;
    template?: string | null;
    cvFilePath?: string | null;
    cvOriginalName?: string | null;
    expoPushToken?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      gmailUser: user.gmailUser || null,
      hasGmailConfigured: Boolean(user.gmailUser && user.gmailAppPassword),
      template: user.template || null,
      hasCv: Boolean(user.cvFilePath),
      cvOriginalName: user.cvOriginalName || null,
      expoPushToken: user.expoPushToken || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException(
        'Un compte avec cette adresse e-mail existe déjà. Veuillez vous connecter.',
      );
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        password: hashedPassword,
        fullName: dto.fullName.trim(),
      },
    });

    // Rattacher les entreprises existantes non attribuées ou initiales au premier utilisateur inscrit
    const userCount = await this.prisma.user.count();
    if (userCount <= 2) {
      await this.prisma.company.updateMany({
        where: {
          OR: [
            { userId: null },
            { userId: '00000000-0000-0000-0000-000000000001' },
          ],
        },
        data: { userId: user.id },
      });
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    }

    const isMatch = await bcryptjs.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const updateData: {
      fullName?: string;
      gmailUser?: string;
      gmailAppPassword?: string;
      template?: string;
      password?: string;
      cvOriginalName?: string;
    } = {};

    if (dto.fullName) {
      updateData.fullName = dto.fullName.trim();
      if (user.cvFilePath) {
        updateData.cvOriginalName = buildStandardCvFileName(updateData.fullName);
      }
    }

    if (dto.gmailUser !== undefined) {
      updateData.gmailUser = dto.gmailUser ? dto.gmailUser.toLowerCase().trim() : '';
    }

    if (dto.gmailAppPassword !== undefined) {
      // Nettoyer les espaces éventuels des mots de passe d'application Google (ex: "abcd efgh ijkl mnop")
      updateData.gmailAppPassword = dto.gmailAppPassword
        ? dto.gmailAppPassword.replace(/\s+/g, '')
        : '';
    }

    if (dto.template !== undefined) {
      updateData.template = dto.template;
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Le mot de passe actuel est requis pour définir un nouveau mot de passe.',
        );
      }
      const isMatch = await bcryptjs.compare(dto.currentPassword, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Le mot de passe actuel est erroné.');
      }
      const salt = await bcryptjs.genSalt(10);
      updateData.password = await bcryptjs.hash(dto.newPassword, salt);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.sanitizeUser(updated);
  }
}
