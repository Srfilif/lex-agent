import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class InvestigateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  pregunta!: string;

  @IsOptional()
  @IsInt()
  max_pasos?: number;
}
