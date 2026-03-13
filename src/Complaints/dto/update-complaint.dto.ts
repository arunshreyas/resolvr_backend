import { StatusEnum } from '@prisma/client/index';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateComplaintDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsEnum(StatusEnum)
  status?: StatusEnum;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;
}
