import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { deleteCommand } from '../../src/commands.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';

describe('delete command integration', () => {
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

  it('deletes an existing profile and verifies it is removed from store', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'personal'), 'registry=https://personal.example.com/\n');

    const result = await deleteCommand(store, 'work');

    expect(result.message).toBe("Deleted profile 'work'");
    expect(await store.profileExists('work')).toBe(false);

    // Verify the profile file is actually gone from the file system
    const entries = await readdir(storePath);
    expect(entries).not.toContain('work');
  });

  it('deleting the active profile clears active state and includes warning', async () => {
    await writeFile(join(storePath, 'staging'), 'registry=https://staging.example.com/\n');
    await writeFile(join(storePath, '.active'), 'staging');

    const result = await deleteCommand(store, 'staging');

    expect(result.message).toBe("Deleted profile 'staging'");
    expect(result.warning).toBe(
      "Profile 'staging' was the active profile. No profile is now active."
    );
    expect(await store.getActiveProfileName()).toBeNull();
    expect(await store.profileExists('staging')).toBe(false);
  });

  it('returns error when trying to delete a non-existent profile', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');

    try {
      await deleteCommand(store, 'ghost');
      expect.fail('Expected deleteCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_NOT_FOUND);
      expect(err.message).toContain('ghost');
    }
  });

  it('returns error when profile name is not provided', async () => {
    try {
      await deleteCommand(store, '');
      expect.fail('Expected deleteCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
      expect(err.message).toContain('required');
    }
  });

  it('other profiles remain unaffected after deletion', async () => {
    const workContent = 'registry=https://work.example.com/\n';
    const personalContent = 'registry=https://personal.example.com/\n';
    const ossContent = 'registry=https://registry.npmjs.org/\n';

    await writeFile(join(storePath, 'work'), workContent);
    await writeFile(join(storePath, 'personal'), personalContent);
    await writeFile(join(storePath, 'oss'), ossContent);
    await writeFile(join(storePath, '.active'), 'personal');

    await deleteCommand(store, 'work');

    // Verify remaining profiles are intact
    expect(await store.profileExists('personal')).toBe(true);
    expect(await store.profileExists('oss')).toBe(true);
    expect(await store.getProfile('personal')).toBe(personalContent);
    expect(await store.getProfile('oss')).toBe(ossContent);

    // Active profile state is unchanged
    expect(await store.getActiveProfileName()).toBe('personal');
  });
});
