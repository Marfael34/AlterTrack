import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  gmailUser?: string | null;
  gmailAppPassword?: string | null;
  template?: string | null;
  cvFilePath?: string | null;
  cvOriginalName?: string | null;
  expoPushToken?: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return null;
    }
    return data ? user[data] : user;
  },
);
