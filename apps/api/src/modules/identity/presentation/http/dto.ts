// DTOs de /auth y /account. ValidationPipe global (whitelist) descarta extras:
// rol, plan o flags enviados por el cliente nunca llegan al caso de uso.
import { Equals, IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  display_name?: string;

  /** Aceptación contractual de los Términos (casilla 1, obligatoria). */
  @IsBoolean()
  @Equals(true)
  terms_accepted!: boolean;

  /** Autorización de tratamiento de datos Ley 1581 (casilla 2, obligatoria). */
  @IsBoolean()
  @Equals(true)
  privacy_accepted!: boolean;

  /** Código de acceso (obligatorio solo en modo `code`). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  access_code?: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  device_label?: string;
}

export class RefreshDto {
  // Opcional: si falta, se lee la cookie lex_refresh.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refresh_token?: string;
}

export class TokenDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;
}

export class EmailDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  current!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  next!: string;
}

export class TotpCodeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(12)
  code!: string;
}

export class TotpDisableDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(12)
  code!: string;
}

export class MfaVerifyDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  mfa_token!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(12)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  device_label?: string;
}
