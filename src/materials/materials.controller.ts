import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Res,
  StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { MaterialsService } from './materials.service.js';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/material.dto.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import type { AuthUser } from '../common/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { materialUploadOptions, relativePath, removeFile } from '../common/upload.js';

/** القراءة: الشاب المقبول + مشرف البرنامج + الأدمن */
@Roles(Role.YOUTH, Role.INSTRUCTOR, Role.ADMIN)
@Controller('programs/:programId/materials')
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('programId', ParseIntPipe) programId: number) {
    return this.materials.list(user, programId);
  }

  @Get(':materialId')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('materialId', ParseIntPipe) materialId: number,
  ) {
    return this.materials.findOne(user, programId, materialId);
  }

  // الملفات لا تُخدَّم كـ static: كل تحميل يمرّ بفحص الصلاحية
  @Get(':materialId/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('materialId', ParseIntPipe) materialId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const m = await this.materials.getFile(user, programId, materialId);
    res.set({
      'Content-Type': m.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(m.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(createReadStream(m.absPath));
  }
}

/** الكتابة: مشرف البرنامج فقط */
@Roles(Role.INSTRUCTOR)
@Controller('instructor/programs/:programId/materials')
export class InstructorMaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  // multipart/form-data: title + file
  @Post()
  @UseInterceptors(FileInterceptor('file', materialUploadOptions))
  async create(
    @CurrentUser('id') instructorId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Body() dto: CreateMaterialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('الملف (file) مطلوب');
    const filePath = relativePath('materials', file);
    try {
      return await this.materials.create(instructorId, programId, dto.title, filePath, file);
    } catch (e) {
      await removeFile(filePath);
      throw e;
    }
  }

  // multipart أو JSON: title و/أو file
  @Patch(':materialId')
  @UseInterceptors(FileInterceptor('file', materialUploadOptions))
  async update(
    @CurrentUser('id') instructorId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('materialId', ParseIntPipe) materialId: number,
    @Body() dto: UpdateMaterialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const upload = file ? { filePath: relativePath('materials', file), file } : undefined;
    try {
      return await this.materials.update(instructorId, programId, materialId, dto.title, upload);
    } catch (e) {
      await removeFile(upload?.filePath);
      throw e;
    }
  }

  @Delete(':materialId')
  remove(
    @CurrentUser('id') instructorId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('materialId', ParseIntPipe) materialId: number,
  ) {
    return this.materials.remove(instructorId, programId, materialId);
  }
}
