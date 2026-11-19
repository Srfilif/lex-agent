// DTOs de /account (perfil, preferencias, correo, borrado).
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MaxLength(80)
  display_name!: string;
}

export class EmailRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsEmail()
  @MaxLength(254)
  new_email!: string;
}

export class TokenDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;
}

export class DeleteConfirmDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;
}

class AiPrefsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsIn(['breve', 'normal', 'detallado'])
  detail?: string;

  @IsOptional()
  @IsIn(['texto', 'markdown'])
  responseFormat?: string;

  @IsOptional()
  @IsBoolean()
  crossMemory?: boolean;
}

class NotifPrefsDto {
  @IsOptional()
  @IsBoolean()
  emailSecurity?: boolean;
}

export class PreferencesDto {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @IsOptional()
  @IsIn(['es', 'en'])
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z_]{1,32}\/[A-Za-z0-9_+\-]{1,32}$/)
  timezone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotifPrefsDto)
  notifications?: NotifPrefsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiPrefsDto)
  ai?: AiPrefsDto;
}

export class MemoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  fact!: string;
}

export class ConsentsDto {
  /** Aceptación contractual de los Términos (independiente de datos). */
  @IsBoolean()
  @Equals(true)
  terms_accepted!: boolean;

  /** Autorización de tratamiento de datos Ley 1581 (independiente). */
  @IsBoolean()
  @Equals(true)
  privacy_accepted!: boolean;
}
