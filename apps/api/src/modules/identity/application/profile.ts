// Perfil público: subconjunto seguro del usuario (nunca hash ni internos).
import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../domain/repositories';
import { User } from '../domain/user';
import { noEncontrado } from './errors';

export function publicUser(u: User): Record<string, unknown> {
  const p = u.snapshot;
  return {
    id: p.id,
    email: p.email,
    display_name: p.displayName,
    email_verified: p.emailVerifiedAt !== null,
    role: p.role,
    created_at: p.createdAt.toISOString(),
  };
}

@Injectable()
export class GetProfile {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const u = await this.users.findById(userId);
    if (!u) throw noEncontrado('cuenta no encontrada');
    return publicUser(u);
  }
}
