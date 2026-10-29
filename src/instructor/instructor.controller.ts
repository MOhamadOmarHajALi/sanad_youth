import {
  BadRequestException, Body, Controller, Param, ParseIntPipe, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProgramsService } from '../programs/programs.service.js';
import { AnnouncementsService } from '../announcements/announcements.service.js';
import { CreateMaterialDto, CreateProgramDto, CreateSessionDto } from '../programs/dto/program.dto.js';
import { CreateAnnouncementDto } from '../announcements/dto/announcement.dto.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { materialUploadOptions, relativePath, removeFile } from '../common/upload.js';

@Roles(Role.INSTRUCTOR)
@Controller('instructor/programs')
export class InstructorController {
  constructor(
    private readonly programs: ProgramsService,
    private readonly announcements: AnnouncementsService,
  ) {}

  @Post()
  createProgram(@CurrentUser('id') id: number, @Body() dto: CreateProgramDto) {
    return this.programs.create(id, dto);
  }

  @Post(':id/sessions')
  addSession(
    @CurrentUser('id') id: number,
    @Param('id', ParseIntPipe) programId: number,
    @Body() dto: CreateSessionDto,
  ) {
    return this.programs.addSession(id, programId, dto);
  }

  // multipart/form-data: title + file
  @Post(':id/materials')
  @UseInterceptors(FileInterceptor('file', materialUploadOptions))
  async addMaterial(
    @CurrentUser('id') id: number,
    @Param('id', ParseIntPipe) programId: number,
    @Body() dto: CreateMaterialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('الملف (file) مطلوب');
    const filePath = relativePath('materials', file);
    try {
      return await this.programs.addMaterial(id, programId, dto.title, filePath, file);
    } catch (e) {
      await removeFile(filePath);
      throw e;
    }
  }

  @Post(':id/announcements')
  announce(
    @CurrentUser('id') id: number,
    @Param('id', ParseIntPipe) programId: number,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcements.createForProgram(id, programId, dto);
  }
}
