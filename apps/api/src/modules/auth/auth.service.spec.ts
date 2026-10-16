jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    sign = jest.fn().mockReturnValue('mock-jwt-token');
  },
}));

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn().mockResolvedValue('$2a$10$mocksalt'),
  hash: jest.fn().mockResolvedValue('$2a$10$mockedhashedpassword'),
  compare: jest.fn(),
}));

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@altertrack.fr',
    password: '$2a$10$hashedpasswordstringexample',
    fullName: 'Rafael Martinez',
    gmailUser: 'rafael@gmail.com',
    gmailAppPassword: 'app-password',
    template: 'Bonjour...',
    cvFilePath: '/uploads/cv.pdf',
    cvOriginalName: 'CV_Rafael.pdf',
    expoPushToken: 'ExponentPushToken[xxx]',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      company: {
        updateMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);

      await expect(
        service.register({
          email: 'test@altertrack.fr',
          password: 'Password123!',
          fullName: 'Rafael Martinez',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user, hash password, generate JWT and return sanitized user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce(mockUser);

      const result = await service.register({
        email: 'test@altertrack.fr',
        password: 'Password123!',
        fullName: 'Rafael Martinez',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe(mockUser.email);
      expect((result.user as any).password).toBeUndefined();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({
          email: 'wrong@altertrack.fr',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.login({
          email: 'test@altertrack.fr',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should authenticate user and return token on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.login({
        email: 'test@altertrack.fr',
        password: 'Password123!',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe(mockUser.id);
      expect((result.user as any).password).toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    it('should update user fields and clean gmailAppPassword spaces', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        fullName: 'Rafael Martinez Updated',
        gmailAppPassword: 'abcd1234efgh5678',
      });

      const result = await service.updateProfile(mockUser.id, {
        fullName: 'Rafael Martinez Updated',
        gmailAppPassword: 'abcd 1234 efgh 5678',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fullName: 'Rafael Martinez Updated',
            gmailAppPassword: 'abcd1234efgh5678',
          }),
        }),
      );
      expect(result.fullName).toBe('Rafael Martinez Updated');
    });
  });
});
