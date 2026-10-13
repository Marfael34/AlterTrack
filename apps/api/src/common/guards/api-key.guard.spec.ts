import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  const validKey = 'my_super_secret_api_key_1234567890';

  beforeEach(() => {
    reflector = new Reflector();
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'apiKey') return validKey;
        return null;
      }),
    } as unknown as ConfigService;

    guard = new ApiKeyGuard(reflector, configService);
  });

  const createMockContext = (
    headers: Record<string, string | undefined>,
    isPublic = false,
  ): ExecutionContext => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access to public routes without checking api key', () => {
    const context = createMockContext({}, true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when valid x-api-key is provided', () => {
    const context = createMockContext({ 'x-api-key': validKey }, false);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when x-api-key is missing', () => {
    const context = createMockContext({}, false);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when x-api-key is invalid', () => {
    const context = createMockContext(
      { 'x-api-key': 'wrong_api_key_value_here' },
      false,
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
