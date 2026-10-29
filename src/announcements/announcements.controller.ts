import { Controller, Get } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Role } from '../generated/prisma/enums.js';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Roles(Role.YOUTH)
  @Get('my')
  my(@CurrentUser('id') userId: number) {
    return this.announcements.forYouth(userId);
  }
}
