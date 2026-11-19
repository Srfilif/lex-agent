// Repositorios pg/sqlite de control de acceso (whitelist + códigos).
// SQL parametrizado; fechas TIMESTAMPTZ/TEXT↔Date.
import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import { asDate, asDateOrNull } from '../../../../shared/db/dialect';
import {
  AccessCode,
  AccessCodeRepository,
  WhitelistEntry,
  WhitelistRepository,
} from '../../domain/repositories';

function asInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) ? n : 0;
}

interface WhitelistRow {
  id: string;
  pattern: string;
  label: string | null;
  created_at: Date;
}

@Injectable()
export class PgWhitelistRepository implements WhitelistRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<WhitelistEntry[]> {
    const r = await this.db.raw.query(
      'SELECT id, pattern, label, created_at FROM access_whitelist ORDER BY created_at DESC',
    );
    return (r.rows as WhitelistRow[]).map((w) => ({
      id: w.id,
      pattern: w.pattern,
      label: w.label,
      createdAt: asDate(w.created_at),
    }));
  }

  async patterns(): Promise<string[]> {
    const r = await this.db.raw.query('SELECT pattern FROM access_whitelist');
    return (r.rows as Array<{ pattern: string }>).map((w) => w.pattern);
  }

  async add(
    id: string,
    pattern: string,
    label: string | null,
    createdBy: string | null,
  ): Promise<WhitelistEntry> {
    const r = await this.db.raw.query(
      `INSERT INTO access_whitelist (id, pattern, label, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id, pattern, label, created_at`,
      [id, pattern, label, createdBy],
    );
    const w = r.rows[0] as WhitelistRow;
    return { id: w.id, pattern: w.pattern, label: w.label, createdAt: asDate(w.created_at) };
  }

  async remove(id: string): Promise<boolean> {
    const r = await this.db.raw.query('DELETE FROM access_whitelist WHERE id = $1', [id]);
    return (r.rowCount ?? 0) > 0;
  }
}

interface CodeRow {
  id: string;
  code_hash: string;
  label: string | null;
  max_uses: number;
  used_count: number;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

function toCode(w: CodeRow): AccessCode {
  return {
    id: w.id,
    codeHash: w.code_hash,
    label: w.label,
    maxUses: asInt(w.max_uses),
    usedCount: asInt(w.used_count),
    expiresAt: asDateOrNull(w.expires_at),
    revokedAt: asDateOrNull(w.revoked_at),
    createdAt: asDate(w.created_at),
  };
}

@Injectable()
export class PgAccessCodeRepository implements AccessCodeRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<AccessCode[]> {
    const r = await this.db.raw.query(
      `SELECT id, code_hash, label, max_uses, used_count, expires_at, revoked_at, created_at
       FROM access_codes ORDER BY created_at DESC`,
    );
    return (r.rows as CodeRow[]).map(toCode);
  }

  async findByHash(codeHash: string): Promise<AccessCode | null> {
    const r = await this.db.raw.query('SELECT * FROM access_codes WHERE code_hash = $1', [codeHash]);
    if (!r.rowCount) return null;
    return toCode(r.rows[0] as CodeRow);
  }

  async insert(c: {
    id: string;
    codeHash: string;
    label: string | null;
    maxUses: number;
    expiresAt: Date | null;
    createdBy: string | null;
  }): Promise<AccessCode> {
    const r = await this.db.raw.query(
      `INSERT INTO access_codes (id, code_hash, label, max_uses, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [c.id, c.codeHash, c.label, c.maxUses, c.expiresAt, c.createdBy],
    );
    return toCode(r.rows[0] as CodeRow);
  }

  async consume(id: string): Promise<boolean> {
    const r = await this.db.raw.query(
      `UPDATE access_codes SET used_count = used_count + 1
       WHERE id = $1 AND revoked_at IS NULL AND used_count < max_uses`,
      [id],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async revoke(id: string, now: Date): Promise<boolean> {
    const r = await this.db.raw.query(
      'UPDATE access_codes SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL',
      [id, now],
    );
    return (r.rowCount ?? 0) > 0;
  }
}
