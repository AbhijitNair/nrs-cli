import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore, NpmrcManager } from '../../src/store.js';
import { createProfileSwitcher } from '../../src/profile-switcher.js';
import { useCommand } from '../../src/commands.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';

describe('useCommand', () => {
  let tempDir;
  let storePath;
  let npmrcPath;
  let config;
  let store;
  let npmrcManager;
  let switcher;

  beforeEach(async () => {
    tempDir = await createTempDir();
    storePath = join(tempDir, '.nrs');
    npmrcPath = join(tempDir, '.npmrc');
    config = { storePath, npmrcPath };
    store = createProfileStore(config);
    npmrcManager = new NpmrcManager(npmrcPath);
    switcher = createProfileSwitcher({
      profileStore: store,
      npmrcManager,
      isInteractive: () => false,
    });
    await mkdir(storePath, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('switches to an exact match profile and returns success message', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');

    const result = await useCommand(switcher, 'work');

    expect(result.message).toBe("Switched to profile 'work'");
    expect(result.warning).toBeUndefined();
  });

  it('switches to a prefix match profile and includes warning', async () => {
    await writeFile(join(storePath, 'production'), 'registry=https://prod.example.com/\n');

    const result = await useCommand(switcher, 'prod');

    expect(result.message).toBe("Switched to profile 'production'");
    expect(result.warning).toContain('prefix');
    expect(result.warning).toContain('production');
  });

  it('throws AMBIGUOUS_MATCH when multiple profiles match prefix', async () => {
    await writeFile(join(storePath, 'prod-a'), 'registry=https://a.example.com/\n');
    await writeFile(join(storePath, 'prod-b'), 'registry=https://b.example.com/\n');

    await expect(useCommand(switcher, 'prod')).rejects.toThrow(NrsError);
    try {
      await useCommand(switcher, 'prod');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.AMBIGUOUS_MATCH);
      expect(err.message).toContain('Ambiguous');
    }
  });

  it('throws PROFILE_NOT_FOUND when no profile matches', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');

    await expect(useCommand(switcher, 'nonexistent')).rejects.toThrow(NrsError);
    try {
      await useCommand(switcher, 'nonexistent');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_NOT_FOUND);
      expect(err.message).toContain('not found');
    }
  });

  it('throws MISSING_ARGUMENT when profile name is empty string', async () => {
    await expect(useCommand(switcher, '')).rejects.toThrow(NrsError);
    try {
      await useCommand(switcher, '');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws MISSING_ARGUMENT when profile name is whitespace only', async () => {
    await expect(useCommand(switcher, '   ')).rejects.toThrow(NrsError);
    try {
      await useCommand(switcher, '   ');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('prefers exact match over prefix matches', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'work-staging'), 'registry=https://staging.example.com/\n');

    const result = await useCommand(switcher, 'work');

    expect(result.message).toBe("Switched to profile 'work'");
    expect(result.warning).toBeUndefined();
  });

  it('throws SWITCH_ABORTED when npmrc is externally modified in non-interactive mode', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, '.active'), 'work');
    // Write different content to npmrc to simulate external modification
    await writeFile(npmrcPath, 'registry=https://modified.example.com/\n');

    await expect(useCommand(switcher, 'work')).rejects.toThrow(NrsError);
    try {
      await useCommand(switcher, 'work');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.SWITCH_ABORTED);
    }
  });
});
