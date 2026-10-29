import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module.js';
import { ProgramsModule } from '../programs/programs.module.js';
import { InstructorController } from './instructor.controller.js';

@Module({ imports: [ProgramsModule, AnnouncementsModule], controllers: [InstructorController] })
export class InstructorModule {}
