import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest, JwtAuthGuard } from './jwt-auth.guard';

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
  secure: isProduction,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body.email ?? '', body.password ?? '');
    response.cookie('access_token', result.accessToken, cookieOptions);
    return { user: result.user };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthRequest) {
    return request.user;
  }
}
