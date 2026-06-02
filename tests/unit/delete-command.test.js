import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { deleteCommand } from '../../src/commands.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';

describe('deleteCommand', () => {
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
    await mkdir(storePath, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('deletes an existing profile and returns success message', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');

    const result = await deleteCommand(store, 'work');

    expect(result.message).toBe("Deleted profile 'work'");
    expect(result.warning).toBeUndefined();
    expect(await store.profileExists('work')).toBe(false);
  });

  it('clears active state and returns warning when deleting active profile', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, '.active'), 'work');

    const result = await deleteCommand(store, 'work');

    expect(result.message).toBe("Deleted profile 'work'");
    expect(result.warning).toBe(
      "Profile 'work' was the active profile. No profile is now active."
    );
    expect(await store.getActiveProfileName()).toBeNull();
    expect(await store.profileExists('work')).toBe(false);
  });

  it('throws MISSING_ARGUMENT when profile name is empty string', async () => {
    await expect(deleteCommand(store, '')).rejects.toThrow(NrsError);
    try {
      await deleteCommand(store, '');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws MISSING_ARGUMENT when profile name is whitespace only', async () => {
    await expect(deleteCommand(store, '   ')).rejects.toThrow(NrsError);
    try {
      await deleteCommand(store, '   ');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws PROFILE_NOT_FOUND when profile does not exist', async () => {
    await expect(deleteCommand(store, 'nonexistent')).rejects.toThrow(NrsError);
    try {
      await deleteCommand(store, 'nonexistent');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_NOT_FOUND);
      expect(err.message).toContain('nonexistent');
    }
  });

  it('does not clear active state when deleting a non-active profile', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'personal'), 'registry=https://personal.example.com/\n');
    await writeFile(join(storePath, '.active'), 'personal');

    const result = await deleteCommand(store, 'work');

    expect(result.warning).toBeUndefined();
    expect(await store.getActiveProfileName()).toBe('personal');
  });
});
