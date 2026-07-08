import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthUser, JwtPayload } from './auth.types';

export interface AuthRequest extends Request {
  user: AuthUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = getBearerToken(request) ?? getCookieToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      request.user = await this.auth.me(payload.sub);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

function getBearerToken(request: Request) {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}

function getCookieToken(request: Request) {
  return request.headers.cookie
    ?.split(';')
    .map((value) => value.trim().split('='))
    .find(([key]) => key === 'access_token')?.[1];
}
