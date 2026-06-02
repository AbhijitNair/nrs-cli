import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';

describe('ProfileStore', () => {
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

  describe('ensureStoreExists', () => {
    it('creates the store directory if it does not exist', async () => {
      await store.ensureStoreExists();
      const { stat } = await import('node:fs/promises');
      const stats = await stat(storePath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('copies existing .npmrc as "default" profile when store is new', async () => {
      const npmrcContent = 'registry=https://registry.npmjs.org/\n';
      await writeFile(npmrcPath, npmrcContent);

      await store.ensureStoreExists();

      const defaultProfile = await readFile(join(storePath, 'default'), 'utf-8');
      expect(defaultProfile).toBe(npmrcContent);
    });

    it('does not copy .npmrc if it does not exist', async () => {
      await store.ensureStoreExists();

      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(storePath);
      expect(entries).toEqual([]);
    });

    it('does not overwrite store if it already exists', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');

      // Create an npmrc that would be copied if store were new
      await writeFile(npmrcPath, 'registry=https://registry.npmjs.org/\n');

      await store.ensureStoreExists();

      // "default" profile should NOT be created since store already existed
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(storePath);
      expect(entries).toEqual(['work']);
    });
  });

  describe('listProfiles', () => {
    it('returns profile names sorted alphabetically', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'work'), 'content');
      await writeFile(join(storePath, 'default'), 'content');
      await writeFile(join(storePath, 'alpha'), 'content');

      const profiles = await store.listProfiles();
      expect(profiles).toEqual(['alpha', 'default', 'work']);
    });

    it('filters out the .active metadata file', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, '.active'), 'work');
      await writeFile(join(storePath, 'work'), 'content');
      await writeFile(join(storePath, 'default'), 'content');

      const profiles = await store.listProfiles();
      expect(profiles).toEqual(['default', 'work']);
    });

    it('returns empty array when store is empty', async () => {
      await mkdir(storePath, { recursive: true });

      const profiles = await store.listProfiles();
      expect(profiles).toEqual([]);
    });
  });

  describe('getProfile', () => {
    it('returns profile content when profile exists', async () => {
      await mkdir(storePath, { recursive: true });
      const content = 'registry=https://registry.npmjs.org/\n';
      await writeFile(join(storePath, 'default'), content);

      const result = await store.getProfile('default');
      expect(result).toBe(content);
    });

    it('returns null when profile does not exist', async () => {
      await mkdir(storePath, { recursive: true });

      const result = await store.getProfile('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('writeProfile', () => {
    it('writes content to a profile file', async () => {
      await mkdir(storePath, { recursive: true });
      const content = 'registry=https://work.example.com/\n';

      await store.writeProfile('work', content);

      const written = await readFile(join(storePath, 'work'), 'utf-8');
      expect(written).toBe(content);
    });

    it('overwrites existing profile content', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'work'), 'old content');

      const newContent = 'registry=https://new.example.com/\n';
      await store.writeProfile('work', newContent);

      const written = await readFile(join(storePath, 'work'), 'utf-8');
      expect(written).toBe(newContent);
    });
  });

  describe('deleteProfile', () => {
    it('deletes an existing profile and returns true', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'work'), 'content');

      const result = await store.deleteProfile('work');
      expect(result).toBe(true);

      const { access } = await import('node:fs/promises');
      await expect(access(join(storePath, 'work'))).rejects.toThrow();
    });

    it('returns false when profile does not exist', async () => {
      await mkdir(storePath, { recursive: true });

      const result = await store.deleteProfile('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('profileExists', () => {
    it('returns true when profile exists', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'work'), 'content');

      const result = await store.profileExists('work');
      expect(result).toBe(true);
    });

    it('returns false when profile does not exist', async () => {
      await mkdir(storePath, { recursive: true });

      const result = await store.profileExists('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getActiveProfileName', () => {
    it('returns the active profile name from .active file', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, '.active'), 'work');

      const result = await store.getActiveProfileName();
      expect(result).toBe('work');
    });

    it('trims whitespace from .active file content', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, '.active'), '  work  \n');

      const result = await store.getActiveProfileName();
      expect(result).toBe('work');
    });

    it('returns null when .active file does not exist', async () => {
      await mkdir(storePath, { recursive: true });

      const result = await store.getActiveProfileName();
      expect(result).toBeNull();
    });

    it('returns null when .active file is empty', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, '.active'), '');

      const result = await store.getActiveProfileName();
      expect(result).toBeNull();
    });

    it('returns null when .active file contains only whitespace', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, '.active'), '   \n  ');

      const result = await store.getActiveProfileName();
      expect(result).toBeNull();
    });
  });

  describe('setActiveProfileName', () => {
    it('writes the profile name to .active file', async () => {
      await mkdir(storePath, { recursive: true });

      await store.setActiveProfileName('work');

      const content = await readFile(join(storePath, '.active'), 'utf-8');
      expect(content).toBe('work');
    });

    it('deletes .active file when name is null', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, '.active'), 'work');

      await store.setActiveProfileName(null);

      const { access } = await import('node:fs/promises');
      await expect(access(join(storePath, '.active'))).rejects.toThrow();
    });

    it('does not throw when deleting .active that does not exist', async () => {
      await mkdir(storePath, { recursive: true });

      await expect(store.setActiveProfileName(null)).resolves.not.toThrow();
    });
  });
});
