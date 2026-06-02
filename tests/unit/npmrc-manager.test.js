import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { writeFile, mkdir, rm, chmod } from 'node:fs/promises';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { NpmrcManager } from '../../src/store.js';

describe('NpmrcManager', () => {
  let tempDir;
  let npmrcPath;
  let manager;

  beforeEach(async () => {
    tempDir = await createTempDir();
    npmrcPath = join(tempDir, '.npmrc');
    manager = new NpmrcManager(npmrcPath);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('read()', () => {
    it('should return file content as Buffer when file exists', async () => {
      const content = 'registry=https://registry.npmjs.org/\n';
      await writeFile(npmrcPath, content, 'utf-8');

      const result = await manager.read();

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('utf-8')).toBe(content);
    });

    it('should return null when file does not exist', async () => {
      const result = await manager.read();

      expect(result).toBeNull();
    });

    it('should return empty Buffer for empty file', async () => {
      await writeFile(npmrcPath, '', 'utf-8');

      const result = await manager.read();

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });

    it('should preserve binary content exactly', async () => {
      const content = 'registry=https://private.registry.com/\n//private.registry.com/:_authToken=abc123\n';
      await writeFile(npmrcPath, content, 'utf-8');

      const result = await manager.read();

      expect(result.toString('utf-8')).toBe(content);
    });
  });

  describe('write()', () => {
    it('should write string content to the npmrc file', async () => {
      const content = 'registry=https://registry.npmjs.org/\n';

      await manager.write(content);

      const { readFile: readFileFs } = await import('node:fs/promises');
      const written = await readFileFs(npmrcPath, 'utf-8');
      expect(written).toBe(content);
    });

    it('should overwrite existing file content', async () => {
      await writeFile(npmrcPath, 'old content', 'utf-8');

      const newContent = 'registry=https://new.registry.com/\n';
      await manager.write(newContent);

      const { readFile: readFileFs } = await import('node:fs/promises');
      const written = await readFileFs(npmrcPath, 'utf-8');
      expect(written).toBe(newContent);
    });

    it('should create the file if it does not exist', async () => {
      const content = 'registry=https://registry.npmjs.org/\n';

      await manager.write(content);

      const { readFile: readFileFs } = await import('node:fs/promises');
      const written = await readFileFs(npmrcPath, 'utf-8');
      expect(written).toBe(content);
    });

    it('should throw NrsError when parent directory does not exist', async () => {
      const badManager = new NpmrcManager(join(tempDir, 'nonexistent', '.npmrc'));

      await expect(badManager.write('content')).rejects.toMatchObject({
        name: 'NrsError',
      });
    });
  });

  describe('exists()', () => {
    it('should return true when file exists', async () => {
      await writeFile(npmrcPath, 'content', 'utf-8');

      const result = await manager.exists();

      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const result = await manager.exists();

      expect(result).toBe(false);
    });

    it('should return true for empty file', async () => {
      await writeFile(npmrcPath, '', 'utf-8');

      const result = await manager.exists();

      expect(result).toBe(true);
    });
  });
});
