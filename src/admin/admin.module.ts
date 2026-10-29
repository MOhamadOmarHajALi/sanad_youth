import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { AdminController } from './admin.controller.js';

@Module({ imports: [ApplicationsModule, AnnouncementsModule], controllers: [AdminController] })
export class AdminModule {}
