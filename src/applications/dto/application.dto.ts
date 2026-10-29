import { Type } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';

export class CreateApplicationDto {
  @Type(() => Number) @IsInt() @Min(1)
  programId: number;
}

export class ReviewApplicationDto {
  @IsIn(['ACCEPTED', 'REJECTED'], { message: 'الحالة يجب أن تكون ACCEPTED أو REJECTED' })
  status: 'ACCEPTED' | 'REJECTED';
}
