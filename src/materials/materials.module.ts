import { Module } from '@nestjs/common';
import { InstructorMaterialsController, MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';

@Module({
  controllers: [MaterialsController, InstructorMaterialsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
