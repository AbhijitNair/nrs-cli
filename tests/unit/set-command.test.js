import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { setCommand } from '../../src/commands.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';

describe('setCommand', () => {
  let tempDir;
  let storePath;
  let npmrcPath;
  let config;
  let store;

  beforeEach(async () => {
    tempDir = await createTempDir();
    storePath = join(tempDir, '.nrs');
    npmrcPath = join(tempDir, '.npmrc');
    config = { storePath, npmrcPath };
    store = createProfileStore(config);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('successful creation', () => {
    it('creates a new profile with registry content', async () => {
      const args = {
        profileName: 'work',
        registry: 'https://registry.work.com/',
      };

      const result = await setCommand(store, args);

      expect(result).toBe("Created profile 'work'");
      const content = await readFile(join(storePath, 'work'), 'utf-8');
      expect(content).toBe('registry=https://registry.work.com/\n');
    });

    it('returns "Created" message for new profiles', async () => {
      const args = {
        profileName: 'new-profile',
        registry: 'https://example.com/',
      };

      const result = await setCommand(store, args);
      expect(result).toBe("Created profile 'new-profile'");
    });
  });

  describe('successful update', () => {
    it('overwrites an existing profile', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'work'), 'registry=https://old.example.com/\n');

      const args = {
        profileName: 'work',
        registry: 'https://new.example.com/',
      };

      const result = await setCommand(store, args);

      expect(result).toBe("Updated profile 'work'");
      const content = await readFile(join(storePath, 'work'), 'utf-8');
      expect(content).toBe('registry=https://new.example.com/\n');
    });

    it('returns "Updated" message for existing profiles', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'existing'), 'registry=https://old.com/\n');

      const args = {
        profileName: 'existing',
        registry: 'https://updated.com/',
      };

      const result = await setCommand(store, args);
      expect(result).toBe("Updated profile 'existing'");
    });
  });

  describe('validation errors', () => {
    it('throws MISSING_ARGUMENT when profileName is empty', async () => {
      const args = {
        profileName: '',
        registry: 'https://example.com/',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.MISSING_ARGUMENT,
      });
    });

    it('throws INVALID_PROFILE_NAME for names with invalid characters', async () => {
      const args = {
        profileName: 'invalid name!',
        registry: 'https://example.com/',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_PROFILE_NAME,
      });
    });

    it('throws INVALID_PROFILE_NAME for names exceeding 64 characters', async () => {
      const args = {
        profileName: 'a'.repeat(65),
        registry: 'https://example.com/',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_PROFILE_NAME,
      });
    });

    it('throws MISSING_ARGUMENT when registry is empty', async () => {
      const args = {
        profileName: 'work',
        registry: '',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.MISSING_ARGUMENT,
      });
    });
  });

  describe('store initialization', () => {
    it('creates the store directory if it does not exist', async () => {
      const args = {
        profileName: 'work',
        registry: 'https://example.com/',
      };

      await setCommand(store, args);

      const { stat } = await import('node:fs/promises');
      const stats = await stat(storePath);
      expect(stats.isDirectory()).toBe(true);
    });
  });
});
