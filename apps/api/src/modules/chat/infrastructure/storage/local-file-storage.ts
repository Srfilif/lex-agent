// Adaptador disco local de FileStorage (I1). Raíz: PROJECT_FILES_DIR.
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../../shared/config';
import { FileStorage } from '../../application/ports';

@Injectable()
export class LocalFileStorage implements FileStorage {
  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  async write(relPath: string, data: Buffer): Promise<void> {
    await mkdir(this.cfg.projectFilesDir, { recursive: true });
    await writeFile(join(this.cfg.projectFilesDir, relPath), data);
  }

  async read(relPath: string): Promise<Buffer> {
    return readFile(join(this.cfg.projectFilesDir, relPath));
  }

  async remove(relPath: string): Promise<void> {
    await unlink(join(this.cfg.projectFilesDir, relPath)).catch(() => undefined);
  }
}
