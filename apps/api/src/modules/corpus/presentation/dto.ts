import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { toNumberOrUndefined } from '../../../shared/presentation/transforms';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @IsOptional()
  @Transform(toNumberOrUndefined)
  @IsInt()
  top_k?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emisor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  jurisdiccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tema?: string;
}
