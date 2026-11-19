// Controlador /auth: registro, login, sesiones, correo y contraseñas.
// Delgado: extrae DTO + meta, invoca el caso de uso, fija/limpia la cookie.
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../../shared/config';
import { RequestMeta } from '../../application/ports';
import {
  ChangePassword,
  RequestPasswordReset,
  ResendVerification,
  ResetPassword,
  VerifyEmail,
} from '../../application/email-password';
import { AccessPolicy } from '../../application/access';
import { LoginUser, RegisterUser } from '../../application/register-login';
import {
  ListSessions,
  Logout,
  LogoutAll,
  RefreshSession,
  RevokeSession,
} from '../../application/sessions';
import { VerifyMfaLogin } from '../../application/totp';
import { AuthErrorFilter } from './auth-error.filter';
import { AuthGuard, AuthUser } from './auth.guard';
import {
  REFRESH_COOKIE,
  CookieWriter,
  clearRefreshCookie,
  parseCookies,
  setRefreshCookie,
} from './cookies';
import { CurrentUser } from './current-user.decorator';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  MfaVerifyDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './dto';

interface RawReq {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

function metaOf(req: RawReq): RequestMeta {
  const h = (k: string): string | null => {
    const v = req.headers[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  const xff = h('x-forwarded-for');
  const ip = (xff?.split(',')[0]?.trim() || req.ip || null) as string | null;
  return { ip, userAgent: h('user-agent') };
}

function refreshFrom(req: RawReq, body?: RefreshDto): string | null {
  if (body?.refresh_token) return body.refresh_token;
  const cookies = parseCookies(
    Array.isArray(req.headers['cookie']) ? req.headers['cookie'][0] : req.headers['cookie'],
  );
  return cookies[REFRESH_COOKIE] ?? null;
}

@Controller('auth')
@UseFilters(AuthErrorFilter)
export class AuthController {
  constructor(
    private readonly register: RegisterUser,
    private readonly login: LoginUser,
    private readonly refresh: RefreshSession,
    private readonly logout: Logout,
    private readonly logoutAll: LogoutAll,
    private readonly verifyEmail: VerifyEmail,
    private readonly resend: ResendVerification,
    private readonly forgot: RequestPasswordReset,
    private readonly reset: ResetPassword,
    private readonly change: ChangePassword,
    private readonly list: ListSessions,
    private readonly revoke: RevokeSession,
    private readonly mfaVerify: VerifyMfaLogin,
    private readonly access: AccessPolicy,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Get('access-mode')
  async accessModeGet(): Promise<Record<string, unknown>> {
    return this.access.state() as unknown as Record<string, unknown>;
  }

  @Post('register')
  async registerPost(@Body() dto: RegisterDto, @Req() req: RawReq): Promise<{ message: string }> {
    return this.register.execute(
      {
        email: dto.email,
        password: dto.password,
        displayName: dto.display_name,
        termsAccepted: dto.terms_accepted,
        privacyAccepted: dto.privacy_accepted,
        accessCode: dto.access_code ?? null,
      },
      metaOf(req),
    );
  }

  @Post('login')
  async loginPost(
    @Body() dto: LoginDto,
    @Req() req: RawReq,
    @Res({ passthrough: true }) res: CookieWriter,
  ): Promise<Record<string, unknown>> {
    const r = await this.login.execute(
      { email: dto.email, password: dto.password, deviceLabel: dto.device_label },
      metaOf(req),
    );
    setRefreshCookie(res, r['refresh_token'] as string, this.cfg.auth);
    return r;
  }

  @Post('mfa/verify')
  async mfaVerifyPost(
    @Body() dto: MfaVerifyDto,
    @Req() req: RawReq,
    @Res({ passthrough: true }) res: CookieWriter,
  ): Promise<Record<string, unknown>> {
    const r = await this.mfaVerify.execute(
      { mfaToken: dto.mfa_token, code: dto.code, deviceLabel: dto.device_label },
      metaOf(req),
    );
    setRefreshCookie(res, r['refresh_token'] as string, this.cfg.auth);
    return r;
  }

  @Post('refresh')
  async refreshPost(
    @Body() dto: RefreshDto,
    @Req() req: RawReq,
    @Res({ passthrough: true }) res: CookieWriter,
  ): Promise<Record<string, unknown>> {
    const token = refreshFrom(req, dto);
    // Sin token → el caso de uso respondería 401 igual; mensaje uniforme.
    const r = await this.refresh.execute(token ?? '', metaOf(req));
    setRefreshCookie(res, r['refresh_token'] as string, this.cfg.auth);
    return r;
  }

  @Post('logout')
  async logoutPost(
    @Body() dto: RefreshDto,
    @Req() req: RawReq,
    @Res({ passthrough: true }) res: CookieWriter,
  ): Promise<{ message: string }> {
    const r = await this.logout.execute(refreshFrom(req, dto), metaOf(req));
    clearRefreshCookie(res, this.cfg.auth);
    return r;
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  async logoutAllPost(
    @CurrentUser() user: AuthUser,
    @Req() req: RawReq,
    @Res({ passthrough: true }) res: CookieWriter,
  ): Promise<Record<string, unknown>> {
    const r = await this.logoutAll.execute(user.id, metaOf(req));
    clearRefreshCookie(res, this.cfg.auth);
    return r;
  }

  @Post('verify-email')
  async verifyPost(@Body() dto: TokenDto, @Req() req: RawReq): Promise<{ message: string }> {
    return this.verifyEmail.execute(dto.token, metaOf(req));
  }

  @Post('resend-verification')
  async resendPost(@Body() dto: EmailDto, @Req() req: RawReq): Promise<{ message: string }> {
    return this.resend.execute(dto.email, metaOf(req));
  }

  @Post('forgot-password')
  async forgotPost(@Body() dto: EmailDto, @Req() req: RawReq): Promise<{ message: string }> {
    return this.forgot.execute(dto.email, metaOf(req));
  }

  @Post('reset-password')
  async resetPost(@Body() dto: ResetPasswordDto, @Req() req: RawReq): Promise<{ message: string }> {
    return this.reset.execute({ token: dto.token, password: dto.password }, metaOf(req));
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  async changePost(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: RawReq,
  ): Promise<{ message: string }> {
    return this.change.execute(
      user.id,
      user.sessionId,
      { current: dto.current, next: dto.next },
      metaOf(req),
    );
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  async sessionsGet(
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return this.list.execute(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  async sessionDelete(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RawReq,
  ): Promise<{ message: string }> {
    return this.revoke.execute(user.id, id, metaOf(req));
  }
}
