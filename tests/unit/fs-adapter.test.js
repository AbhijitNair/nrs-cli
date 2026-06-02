import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  readFile,
  readFileBuffer,
  writeFile,
  readdir,
  unlink,
  mkdir,
  stat,
  access,
  joinPath,
  resolvePath,
} from '../../src/fs-adapter.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';

describe('fs-adapter', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('readFile', () => {
    it('reads file content as UTF-8 string', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'hello world', 'utf-8');

      const content = await readFile(filePath);
      expect(content).toBe('hello world');
    });

    it('throws NrsError with FILE_READ_ERROR for missing file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');

      try {
        await readFile(filePath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NrsError);
        expect(err.code).toBe(ErrorCodes.FILE_READ_ERROR);
        expect(err.details?.path).toBe(path.resolve(filePath));
        expect(err.details?.operation).toBe('readFile');
      }
    });
  });

  describe('readFileBuffer', () => {
    it('reads file content as Buffer', async () => {
      const filePath = path.join(tempDir, 'binary.bin');
      const data = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      await fs.writeFile(filePath, data);

      const result = await readFileBuffer(filePath);
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.equals(data)).toBe(true);
    });

    it('throws NrsError with FILE_READ_ERROR for missing file', async () => {
      const filePath = path.join(tempDir, 'missing.bin');

      try {
        await readFileBuffer(filePath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NrsError);
        expect(err.code).toBe(ErrorCodes.FILE_READ_ERROR);
        expect(err.details?.operation).toBe('readFile');
      }
    });
  });

  describe('writeFile', () => {
    it('writes string content to a file', async () => {
      const filePath = path.join(tempDir, 'output.txt');

      await writeFile(filePath, 'test content');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('test content');
    });

    it('overwrites existing file content', async () => {
      const filePath = path.join(tempDir, 'overwrite.txt');
      await fs.writeFile(filePath, 'old content', 'utf-8');

      await writeFile(filePath, 'new content');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('throws NrsError with FILE_WRITE_ERROR for invalid path', async () => {
      const filePath = path.join(tempDir, 'nonexistent-dir', 'file.txt');

      try {
        await writeFile(filePath, 'content');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NrsError);
        expect(err.code).toBe(ErrorCodes.FILE_WRITE_ERROR);
        expect(err.details?.path).toBe(path.resolve(filePath));
        expect(err.details?.operation).toBe('writeFile');
      }
    });
  });

  describe('readdir', () => {
    it('returns directory entries', async () => {
      await fs.writeFile(path.join(tempDir, 'a.txt'), '');
      await fs.writeFile(path.join(tempDir, 'b.txt'), '');

      const entries = await readdir(tempDir);
      expect(entries).toContain('a.txt');
      expect(entries).toContain('b.txt');
    });

    it('throws NrsError with FILE_READ_ERROR for missing directory', async () => {
      const dirPath = path.join(tempDir, 'no-such-dir');

      try {
        await readdir(dirPath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NrsError);
        expect(err.code).toBe(ErrorCodes.FILE_READ_ERROR);
        expect(err.details?.operation).toBe('readdir');
      }
    });
  });

  describe('unlink', () => {
    it('deletes a file', async () => {
      const filePath = path.join(tempDir, 'to-delete.txt');
      await fs.writeFile(filePath, 'delete me');

      await unlink(filePath);

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('throws NrsError with FILE_DELETE_ERROR for missing file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');

      try {
        await unlink(filePath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NrsError);
        expect(err.code).toBe(ErrorCodes.FILE_DELETE_ERROR);
        expect(err.details?.path).toBe(path.resolve(filePath));
        expect(err.details?.operation).toBe('unlink');
      }
    });
  });

  describe('mkdir', () => {
    it('creates a directory', async () => {
      const dirPath = path.join(tempDir, 'new-dir');

      await mkdir(dirPath);

      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('creates nested directories recursively by default', async () => {
      const dirPath = path.join(tempDir, 'a', 'b', 'c');

      await mkdir(dirPath);

      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('stat', () => {
    it('returns stats for an existing file', async () => {
      const filePath = path.join(tempDir, 'stat-test.txt');
      await fs.writeFile(filePath, 'content');

      const result = await stat(filePath);
      expect(result.isFile()).toBe(true);
    });

    it('returns stats for a directory', async () => {
      const result = await stat(tempDir);
      expect(result.isDirectory()).toBe(true);
    });

    it('throws NrsError with FILE_READ_ERROR for missing path', async () => {
      const filePath = path.join(tempDir, 'no-such-file');

      try {
        await stat(filePath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NrsError);
        expect(err.code).toBe(ErrorCodes.FILE_READ_ERROR);
        expect(err.details?.operation).toBe('stat');
      }
    });
  });

  describe('access', () => {
    it('resolves for an accessible file', async () => {
      const filePath = path.join(tempDir, 'accessible.txt');
      await fs.writeFile(filePath, 'content');

      await expect(access(filePath)).resolves.toBeUndefined();
    });

    it('throws NrsError with FILE_READ_ERROR for missing file', async () => {
      const filePath = path.join(tempDir, 'missing.txt');

      try {
        await access(filePath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NrsError);
        expect(err.code).toBe(ErrorCodes.FILE_READ_ERROR);
        expect(err.details?.operation).toBe('access');
      }
    });
  });

  describe('joinPath', () => {
    it('joins path segments', () => {
      const result = joinPath('a', 'b', 'c.txt');
      expect(result).toBe(path.join('a', 'b', 'c.txt'));
    });
  });

  describe('resolvePath', () => {
    it('resolves to an absolute path', () => {
      const result = resolvePath('relative', 'path');
      expect(path.isAbsolute(result)).toBe(true);
    });
  });
});
