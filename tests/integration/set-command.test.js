import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { setCommand } from '../../src/commands.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';

describe('set command integration', () => {
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

  describe('creating new profiles', () => {
    it('creates a new profile with registry URL content', async () => {
      const args = {
        profileName: 'work',
        registry: 'https://registry.work.com/',
      };

      const result = await setCommand(store, args);

      expect(result).toBe("Created profile 'work'");

      // Verify file content in store directory
      const content = await readFile(join(storePath, 'work'), 'utf-8');
      expect(content).toBe('registry=https://registry.work.com/\n');
    });

    it('reports "Created" for new profiles', async () => {
      const result = await setCommand(store, {
        profileName: 'my-registry',
        registry: 'https://npm.example.org/',
      });

      expect(result).toContain('Created');
      expect(result).toContain('my-registry');
    });

    it('creates the store directory if it does not exist', async () => {
      const args = {
        profileName: 'first',
        registry: 'https://registry.npmjs.org/',
      };

      await setCommand(store, args);

      const { stat } = await import('node:fs/promises');
      const stats = await stat(storePath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('stores profile file content as registry=<url> followed by newline', async () => {
      const url = 'https://custom.registry.io/npm/';
      await setCommand(store, { profileName: 'custom', registry: url });

      const content = await readFile(join(storePath, 'custom'), 'utf-8');
      expect(content).toBe(`registry=${url}\n`);
    });
  });

  describe('updating existing profiles', () => {
    it('updates an existing profile with new registry URL', async () => {
      // Create initial profile
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'work'), 'registry=https://old.registry.com/\n');

      const args = {
        profileName: 'work',
        registry: 'https://new.registry.com/',
      };

      const result = await setCommand(store, args);

      expect(result).toBe("Updated profile 'work'");

      // Verify updated content in store
      const content = await readFile(join(storePath, 'work'), 'utf-8');
      expect(content).toBe('registry=https://new.registry.com/\n');
    });

    it('reports "Updated" for existing profiles', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(join(storePath, 'existing'), 'registry=https://old.com/\n');

      const result = await setCommand(store, {
        profileName: 'existing',
        registry: 'https://updated.com/',
      });

      expect(result).toContain('Updated');
      expect(result).toContain('existing');
    });

    it('completely replaces old profile content', async () => {
      await mkdir(storePath, { recursive: true });
      await writeFile(
        join(storePath, 'multi'),
        'registry=https://old.com/\n//old.com/:_authToken=token123\n'
      );

      await setCommand(store, {
        profileName: 'multi',
        registry: 'https://replacement.com/',
      });

      const content = await readFile(join(storePath, 'multi'), 'utf-8');
      expect(content).toBe('registry=https://replacement.com/\n');
    });
  });

  describe('invalid profile name rejection', () => {
    it('rejects names with spaces', async () => {
      const args = {
        profileName: 'my profile',
        registry: 'https://example.com/',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_PROFILE_NAME,
      });
    });

    it('rejects names with special characters', async () => {
      const args = {
        profileName: 'work@home!',
        registry: 'https://example.com/',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_PROFILE_NAME,
      });
    });

    it('rejects names exceeding 64 characters', async () => {
      const args = {
        profileName: 'a'.repeat(65),
        registry: 'https://example.com/',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_PROFILE_NAME,
      });
    });

    it('rejects names with dots', async () => {
      const args = {
        profileName: 'my.profile',
        registry: 'https://example.com/',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_PROFILE_NAME,
      });
    });
  });

  describe('missing argument errors', () => {
    it('returns error when registry value is missing', async () => {
      const args = {
        profileName: 'work',
        registry: '',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.MISSING_ARGUMENT,
        message: expect.stringContaining('Registry'),
      });
    });

    it('returns error when profile name is missing', async () => {
      const args = {
        profileName: '',
        registry: 'https://example.com/',
      };

      await expect(setCommand(store, args)).rejects.toThrow(NrsError);
      await expect(setCommand(store, args)).rejects.toMatchObject({
        code: ErrorCodes.MISSING_ARGUMENT,
        message: expect.stringContaining('Profile name'),
      });
    });
  });

  describe('profile file content verification', () => {
    it('stores content in exact format registry=<url> with trailing newline', async () => {
      const registryUrl = 'https://registry.npmjs.org/';
      await setCommand(store, { profileName: 'default', registry: registryUrl });

      const filePath = join(storePath, 'default');
      const content = await readFile(filePath, 'utf-8');

      expect(content).toBe(`registry=${registryUrl}\n`);
      expect(content).toMatch(/^registry=.+\n$/);
    });

    it('preserves the full URL including path segments', async () => {
      const registryUrl = 'https://npm.pkg.github.com/@myorg';
      await setCommand(store, { profileName: 'github', registry: registryUrl });

      const content = await readFile(join(storePath, 'github'), 'utf-8');
      expect(content).toBe(`registry=${registryUrl}\n`);
    });

    it('profile file is readable after creation', async () => {
      await setCommand(store, {
        profileName: 'readable',
        registry: 'https://registry.example.com/',
      });

      // Verify via store API as well
      const profileContent = await store.getProfile('readable');
      expect(profileContent).toBe('registry=https://registry.example.com/\n');
    });

    it('profile exists in store after creation', async () => {
      await setCommand(store, {
        profileName: 'verify-exists',
        registry: 'https://registry.example.com/',
      });

      const exists = await store.profileExists('verify-exists');
      expect(exists).toBe(true);
    });
  });
});
