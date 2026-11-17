import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { toNumberOrUndefined } from '../../../../shared/presentation/transforms';

export class SecopQueryDto {
  @IsOptional() @IsString() @MaxLength(200) entidad?: string;
  @IsOptional() @IsString() @MaxLength(200) proveedor?: string;
  @IsOptional() @IsString() @MaxLength(500) objeto?: string;

  @IsOptional() @Transform(toNumberOrUndefined) @IsNumber() valor_min?: number;
  @IsOptional() @Transform(toNumberOrUndefined) @IsNumber() valor_max?: number;

  @IsOptional() @IsString() @MaxLength(100) modalidad?: string;
  @IsOptional() @IsString() @MaxLength(100) estado?: string;

  @IsOptional() @Transform(toNumberOrUndefined) @IsInt() anio?: number;
  @IsOptional() @Transform(toNumberOrUndefined) @IsInt() limit?: number;
}
