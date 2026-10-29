import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProgramsModule } from './programs/programs.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { InstructorModule } from './instructor/instructor.module.js';
import { AdminModule } from './admin/admin.module.js';
import { JwtAuthGuard, RolesGuard } from './common/guards.js';
import { MaterialsModule } from './materials/materials.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 30_000 }),
    // حدّ عام خفيف (100 طلب/دقيقة لكل IP)، وحدود أشد على مسارات الدخول
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    ProgramsModule,
    ApplicationsModule,
    AnnouncementsModule,
    InstructorModule,
    AdminModule,
    MaterialsModule
  ],
  providers: [
    // الترتيب مهم: Throttler ← JWT ← Roles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
