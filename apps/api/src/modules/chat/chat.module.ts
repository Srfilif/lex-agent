// Módulo chat: conversaciones + agente + proyectos + compartir (B5/B9).
import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { CorpusModule } from '../corpus';
import { IdentityModule } from '../identity';
import { BillingModule } from '../billing';
import { AccountModule } from '../account';
import { SecopModule } from '../../secop/secop.module';
import {
  CONVERSATION_REPOSITORY,
  MESSAGE_REPOSITORY,
  PROJECT_FILE_REPOSITORY,
  PROJECT_REPOSITORY,
  SHARE_REPOSITORY,
} from './domain/repositories';
import { ChatAgent, GenerateTitle, SendChatMessage } from './application/chat-agent';
import { ChatModels } from './application/chat-models';
import { ChatSuggestions } from './application/chat-suggestions';
import { ThreadSummarizer } from './application/thread-summarizer';
import { Conversations } from './application/conversations';
import { Projects } from './application/projects';
import { ProjectFiles } from './application/project-files';
import {
  PgConversationRepository,
  PgMessageRepository,
  PgProjectRepository,
  PgShareRepository,
} from './infrastructure/persistence/pg-chat.repositories';
import { PgProjectFileRepository } from './infrastructure/persistence/pg-project-files.repository';
import { FILE_STORAGE } from './application/ports';
import { LocalFileStorage } from './infrastructure/storage/local-file-storage';
import { ChatController } from './presentation/http/chat.controller';
import { SharedChatController } from './presentation/http/shared.controller';

@Module({
  imports: [SharedModule, IdentityModule, BillingModule, AccountModule, CorpusModule, SecopModule],
  controllers: [ChatController, SharedChatController],
  providers: [
    { provide: CONVERSATION_REPOSITORY, useClass: PgConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: PgMessageRepository },
    { provide: PROJECT_REPOSITORY, useClass: PgProjectRepository },
    { provide: SHARE_REPOSITORY, useClass: PgShareRepository },
    { provide: PROJECT_FILE_REPOSITORY, useClass: PgProjectFileRepository },
    { provide: FILE_STORAGE, useClass: LocalFileStorage },
    Conversations,
    Projects,
    ProjectFiles,
    ChatAgent,
    SendChatMessage,
    GenerateTitle,
    ChatModels,
    ChatSuggestions,
    ThreadSummarizer,
  ],
})
export class ChatModule {}
