import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationsService } from './applications.service.js';
import { CreateApplicationDto } from './dto/application.dto.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { assertPdf, cvUploadOptions, relativePath, removeFile } from '../common/upload.js';

@Roles(Role.YOUTH)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  // multipart/form-data: programId + cv (PDF)
  @Post()
  @UseInterceptors(FileInterceptor('cv', cvUploadOptions))
  async apply(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateApplicationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('ملف السيرة الذاتية (cv) مطلوب بصيغة PDF');
    const cvPath = relativePath('cv', file);
    try {
      await assertPdf(cvPath);
      return await this.applications.apply(userId, dto.programId, cvPath);
    } catch (e) {
      await removeFile(cvPath); // لا نترك ملفات يتيمة عند الفشل
      throw e;
    }
  }

  @Get('my')
  my(@CurrentUser('id') userId: number) {
    return this.applications.mine(userId);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.applications.cancel(userId, id);
  }
}
