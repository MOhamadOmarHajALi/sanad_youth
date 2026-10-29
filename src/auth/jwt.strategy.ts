import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/decorators.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  /** نتحقق من الجلسة والمستخدم في قاعدة البيانات: الـ logout وتعطيل الحساب يسريان فوراً */
  async validate(payload: { sub: number; sid: number }): Promise<AuthUser> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: { select: { id: true, role: true, isActive: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) {
      throw new UnauthorizedException();
    }
    return { id: session.user.id, role: session.user.role, sid: session.id };
  }
}
