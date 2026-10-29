import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../generated/prisma/enums.js';
import { isUniqueError } from '../common/prisma-errors.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const USER_SAFE_SELECT = {
  id: true, fullName: true, username: true, email: true, role: true, createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const password = await bcrypt.hash(dto.password, 10);
    try {
      // الدور YOUTH دائماً: لا نمرّر أي حقل آخر من الـ body
      const user = await this.prisma.user.create({
        data: { fullName: dto.fullName, username: dto.username, email: dto.email.toLowerCase(), password },
        select: USER_SAFE_SELECT,
      });
      return { user, message: 'تم إنشاء الحساب بنجاح' };
    } catch (e) {
      if (isUniqueError(e)) throw new ConflictException('اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً');
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier.toLowerCase() }, { username: dto.identifier }] },
    });
    const ok = user ? await bcrypt.compare(dto.password, user.password) : false;
    if (!user || !ok || !user.isActive) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const session = await this.prisma.authSession.create({
      data: { userId: user.id, refreshTokenHash: '', expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    const tokens = await this.issueTokens(user.id, user.role, session.id);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.hash(tokens.refreshToken) },
    });
    return {tokens:tokens,Role:user.role};
  }

  async refresh(refreshToken: string) {
    let payload: { sub: number; sid: number };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) {
      throw new UnauthorizedException('الجلسة منتهية أو ملغاة');
    }
    // إعادة استخدام refresh token قديم = احتمال سرقة → نلغي الجلسة
    if (session.refreshTokenHash !== this.hash(refreshToken)) {
      await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('رمز التحديث غير مطابق');
    }

    const tokens = await this.issueTokens(session.user.id, session.user.role, session.id);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hash(tokens.refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return tokens;
  }

  async logout(sid: number) {
    await this.prisma.authSession.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } });
    return { message: 'تم تسجيل الخروج' };
  }

  private async issueTokens(userId: number, role: Role, sid: number) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, role, sid },
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' },
      ),
      this.jwt.signAsync(
        { sub: userId, sid },
        { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: '7d', jwtid: randomUUID() },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
