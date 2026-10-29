import { Body, ConflictException, Controller, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApplicationsService } from '../applications/applications.service.js';
import { AnnouncementsService } from '../announcements/announcements.service.js';
import { CreateInstructorDto } from './dto/admin.dto.js';
import { ReviewApplicationDto } from '../applications/dto/application.dto.js';
import { CreateAnnouncementDto } from '../announcements/dto/announcement.dto.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { isUniqueError } from '../common/prisma-errors.js';
import { USER_SAFE_SELECT } from '../auth/auth.service.js';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    private readonly announcements: AnnouncementsService,
  ) {}

  @Post('instructors')
  async createInstructor(@Body() dto: CreateInstructorDto) {
    try {
      return await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          username: dto.username,
          email: dto.email.toLowerCase(),
          password: await bcrypt.hash(dto.password, 10),
          role: Role.INSTRUCTOR,
        },
        select: USER_SAFE_SELECT,
      });
    } catch (e) {
      if (isUniqueError(e)) throw new ConflictException('اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً');
      throw e;
    }
  }

  @Patch('applications/:id')
  review(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.applications.review(adminId, id, dto.status);
  }

  @Post('announcements')
  announce(@CurrentUser('id') adminId: number, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.createGeneral(adminId, dto);
  }
}
