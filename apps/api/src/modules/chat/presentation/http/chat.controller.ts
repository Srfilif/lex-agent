// Controlador /chat: CRUD de conversaciones + envío/stream de mensajes.
// Eventos SSE: meta → tool* → token* → citas → done | error.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AuthError,
  AuthErrorFilter,
  AuthGuard,
  AuthUser,
  CurrentUser,
} from '../../../identity';
import { GenerateTitle, SendChatMessage } from '../../application/chat-agent';
import { ChatModels } from '../../application/chat-models';
import { ChatSuggestions } from '../../application/chat-suggestions';
import { Conversations } from '../../application/conversations';
import { Projects } from '../../application/projects';
import { ProjectFiles } from '../../application/project-files';
import { MAX_FILE_BYTES } from '../../domain/project-files';
import { SseResponse, SseWriter } from '../../infrastructure/sse/sse-writer';
import {
  CreateConversationDto,
  CreateProjectDto,
  ListConversationsDto,
  RegenerateDto,
  SearchDto,
  SendMessageDto,
  UpdateConversationDto,
  UpdateProjectDto,
} from './dto';

/** Forma estructural del archivo multer (evita @types/multer). */
interface UploadedFileShape {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('chat')
@UseFilters(AuthErrorFilter)
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly convs: Conversations,
    private readonly send: SendChatMessage,
    private readonly titles: GenerateTitle,
    private readonly projects: Projects,
    private readonly pfiles: ProjectFiles,
    private readonly models: ChatModels,
    private readonly suggestions: ChatSuggestions,
  ) {}

  @Post('conversations')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
  ): Promise<Record<string, unknown>> {
    return this.convs.create(user.id, dto.title);
  }

  @Get('conversations')
  async list(
    @CurrentUser() user: AuthUser,
    @Query() q: ListConversationsDto,
  ): Promise<Record<string, unknown>> {
    return this.convs.list(user.id, {
      limit: q.limit ?? 20,
      offset: q.offset ?? 0,
      archived: q.archived ?? false,
      projectId: q.project_id,
    });
  }

  @Get('conversations/:id')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    return this.convs.get(user.id, id);
  }

  @Get('conversations/:id/sugerencias')
  async sugerencias(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    return this.suggestions.execute(user.id, id);
  }

  @Patch('conversations/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateConversationDto,
  ): Promise<Record<string, unknown>> {
    return this.convs.update(user.id, id, {
      title: dto.title,
      archived: dto.archived,
      projectId: dto.project_id,
    });
  }

  @Delete('conversations/:id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ message: string }> {
    return this.convs.remove(user.id, id);
  }

  @Get('conversations/:id/export')
  async export(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    return this.convs.exportMarkdown(user.id, id);
  }

  @Post('conversations/:id/share')
  async share(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    return this.convs.share(user.id, id);
  }

  @Delete('conversations/:id/share')
  async unshare(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ revoked: number }> {
    return this.convs.unshare(user.id, id);
  }

  @Get('search')
  async search(
    @CurrentUser() user: AuthUser,
    @Query() q: SearchDto,
  ): Promise<Record<string, unknown>> {
    return this.convs.search(user.id, q.q, q.limit ?? 20);
  }

  @Post('projects')
  async createProject(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProjectDto,
  ): Promise<Record<string, unknown>> {
    return this.projects.create(user.id, { name: dto.name, instructions: dto.instructions });
  }

  @Get('projects')
  async listProjects(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.projects.list(user.id);
  }

  @Get('projects/:id')
  async getProject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    return this.projects.get(user.id, id);
  }

  @Patch('projects/:id')
  async updateProject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Record<string, unknown>> {
    return this.projects.update(user.id, id, { name: dto.name, instructions: dto.instructions });
  }

  @Delete('projects/:id')
  async removeProject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ message: string }> {
    return this.projects.remove(user.id, id);
  }

  @Post('regenerate')
  async regenerate(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegenerateDto,
  ): Promise<Record<string, unknown>> {
    return this.send.regenerate(
      user.id,
      { conversationId: dto.conversation_id, model: dto.model },
      { onToken: () => undefined, onTool: () => undefined },
    );
  }

  @Get('citas/:id')
  async cita(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    return this.convs.getCita(user.id, id);
  }

  @Post('projects/:id/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async uploadFile(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: UploadedFileShape | undefined,
  ): Promise<Record<string, unknown>> {
    if (!file || !file.buffer) throw new AuthError(400, 'archivo_invalido', 'falta el archivo (campo file)');
    return this.pfiles.upload(user.id, id, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    });
  }

  @Get('projects/:id/files')
  async listFiles(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    return this.pfiles.list(user.id, id);
  }

  @Delete('projects/:id/files/:fileId')
  async removeFile(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('fileId', new ParseUUIDPipe({ version: '4' })) fileId: string,
  ): Promise<{ message: string }> {
    return this.pfiles.remove(user.id, id, fileId);
  }

  /** Storage: todo lo subido por el usuario (vista /storage). */
  @Get('files')
  async listAllFiles(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.pfiles.listAll(user.id);
  }

  /** Storage: descarga el original. */
  @Get('files/:fileId/download')
  async downloadFile(
    @CurrentUser() user: AuthUser,
    @Param('fileId', new ParseUUIDPipe({ version: '4' })) fileId: string,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string): void },
  ): Promise<StreamableFile> {
    const d = await this.pfiles.download(user.id, fileId);
    const safe = d.filename.replace(/["\\]/g, '').slice(0, 120) || 'archivo';
    res.setHeader('Content-Type', d.mime);
    res.setHeader('Content-Length', String(d.size));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(d.filename).slice(0, 180)}`,
    );
    return new StreamableFile(d.buffer);
  }

  @Get('modelos')
  async modelos(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.models.execute(user.id);
  }

  @Post('send')
  async sendPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
  ): Promise<Record<string, unknown>> {
    const out = await this.send.execute(
      user.id,
      {
        conversationId: dto.conversation_id ?? null,
        content: dto.content,
        model: dto.model,
        projectId: dto.project_id ?? undefined,
      },
      { onToken: () => undefined, onTool: () => undefined },
    );
    if (out['is_new']) {
      void this.titles.execute(user.id, out['conversation_id'] as string, dto.content).catch(() => undefined);
    }
    return out;
  }

  @Post('stream')
  @HttpCode(200)
  async streamPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
    @Res() res: SseResponse,
  ): Promise<void> {
    const sse = new SseWriter(res);
    try {
      let convId = dto.conversation_id ?? null;
      let isNew = false;
      if (!convId) {
        const created = await this.convs.create(user.id);
        convId = created['id'] as string;
        isNew = true;
        // B6: asignar proyecto ANTES del primer mensaje (valida propiedad).
        if (dto.project_id) {
          await this.convs.update(user.id, convId, { projectId: dto.project_id });
        }
      }
      sse.send('meta', { conversation_id: convId, is_new: isNew });
      const out = await this.send.execute(
        user.id,
        { conversationId: convId, content: dto.content, model: dto.model },
        {
          onToken: (delta) => sse.send('token', { delta }),
          onTool: (name) => sse.send('tool', { name }),
        },
      );
      const msg = out['message'] as Record<string, unknown>;
      sse.send('citas', { citations: msg['citations'] ?? [] });
      sse.send('done', {
        message_id: msg['id'],
        usage: out['usage'],
        costo_usd: out['costo_usd'],
        model: msg['model'],
      });
      sse.end();
      if (isNew) {
        void this.titles.execute(user.id, convId, dto.content).catch(() => undefined);
      }
    } catch (e) {
      if (e instanceof AuthError) {
        sse.send('error', { statusCode: e.status, message: e.message, code: e.code });
      } else {
        // eslint-disable-next-line no-console
        console.error(`[chat] stream falló: ${(e as Error).message}`);
        sse.send('error', { statusCode: 500, message: 'Internal server error' });
      }
      sse.end();
    }
  }
}
