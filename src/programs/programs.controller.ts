import { Controller, Get, Param, ParseIntPipe, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { ProgramsService } from './programs.service.js';
import { ListProgramsDto } from './dto/program.dto.js';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import type { AuthUser } from '../common/decorators.js';
import { Role } from '../generated/prisma/enums.js';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListProgramsDto) {
    return this.programs.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.programs.findOne(id);
  }

  @Roles(Role.YOUTH, Role.INSTRUCTOR, Role.ADMIN)
  @Get(':id/materials')
  materials(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.programs.listMaterials(user, id);
  }

  // الملفات لا تُخدَّم كـ static: كل تحميل يمرّ عبر فحص الصلاحية
  @Roles(Role.YOUTH, Role.INSTRUCTOR, Role.ADMIN)
  @Get(':id/materials/:materialId/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('materialId', ParseIntPipe) materialId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const m = await this.programs.getMaterialFile(user, id, materialId);
    res.set({
      'Content-Type': m.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(m.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(createReadStream(m.absPath));
  }
}
