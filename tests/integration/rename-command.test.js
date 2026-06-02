import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readdir } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { renameCommand } from '../../src/commands.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), 'src', 'cli.js');

async function runCli(args, env) {
  const mergedEnv = { ...process.env, ...env };
  const command = `node "${CLI_PATH}" ${args.join(' ')}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      env: mergedEnv,
      timeout: 15000,
      cwd: process.cwd(),
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      exitCode: error.code ?? 1,
    };
  }
}

describe('rename command integration', () => {
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

  it('renames an existing profile and verifies content is preserved', async () => {
    const content = 'registry=https://work.example.com/\n';
    await writeFile(join(storePath, 'work'), content);

    const result = await renameCommand(store, 'work', 'office', {
      isInteractive: () => false,
    });

    expect(result.message).toBe("Renamed profile 'work' to 'office'");
    expect(await store.profileExists('work')).toBe(false);
    expect(await store.profileExists('office')).toBe(true);
    expect(await store.getProfile('office')).toBe(content);
  });

  it('updates active marker when renaming the active profile', async () => {
    await writeFile(join(storePath, 'dev'), 'registry=https://dev.example.com/\n');
    await writeFile(join(storePath, '.active'), 'dev');

    await renameCommand(store, 'dev', 'development', {
      isInteractive: () => false,
    });

    expect(await store.getActiveProfileName()).toBe('development');
    expect(await store.profileExists('dev')).toBe(false);
    expect(await store.profileExists('development')).toBe(true);
  });

  it('leaves active marker unchanged when renaming a non-active profile', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'personal'), 'registry=https://personal.example.com/\n');
    await writeFile(join(storePath, '.active'), 'personal');

    await renameCommand(store, 'work', 'office', {
      isInteractive: () => false,
    });

    expect(await store.getActiveProfileName()).toBe('personal');
  });

  it('throws PROFILE_NOT_FOUND when source does not exist', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');

    try {
      await renameCommand(store, 'ghost', 'newname', {
        isInteractive: () => false,
      });
      expect.fail('Expected renameCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_NOT_FOUND);
      expect(err.message).toContain('ghost');
    }
  });

  it('throws MISSING_ARGUMENT when old name is empty', async () => {
    try {
      await renameCommand(store, '', 'newname', {
        isInteractive: () => false,
      });
      expect.fail('Expected renameCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws MISSING_ARGUMENT when new name is empty', async () => {
    try {
      await renameCommand(store, 'work', '', {
        isInteractive: () => false,
      });
      expect.fail('Expected renameCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws PROFILE_EXISTS when destination exists in non-interactive mode', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'office'), 'registry=https://office.example.com/\n');

    try {
      await renameCommand(store, 'work', 'office', {
        isInteractive: () => false,
      });
      expect.fail('Expected renameCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_EXISTS);
      expect(err.message).toContain('office');
    }
  });

  it('other profiles remain unaffected after rename', async () => {
    const workContent = 'registry=https://work.example.com/\n';
    const personalContent = 'registry=https://personal.example.com/\n';

    await writeFile(join(storePath, 'work'), workContent);
    await writeFile(join(storePath, 'personal'), personalContent);

    await renameCommand(store, 'work', 'office', {
      isInteractive: () => false,
    });

    expect(await store.profileExists('personal')).toBe(true);
    expect(await store.getProfile('personal')).toBe(personalContent);
  });

  describe('CLI invocation', () => {
    function cliEnv() {
      return { NRS_STORE: storePath, NRS_NPMRC: npmrcPath };
    }

    it('renames a profile via CLI end-to-end', async () => {
      await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');

      const result = await runCli(['rename', 'work', 'office'], cliEnv());

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Renamed profile 'work' to 'office'");

      // Verify file system state
      const entries = await readdir(storePath);
      expect(entries).toContain('office');
      expect(entries).not.toContain('work');
    });

    it('outputs error for non-existent source profile', async () => {
      const result = await runCli(['rename', 'ghost', 'newname'], cliEnv());

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('ghost');
    });

    it('outputs error when missing arguments', async () => {
      const result = await runCli(['rename'], cliEnv());

      expect(result.exitCode).toBe(1);
    });

    it('nrs help includes rename command', async () => {
      const result = await runCli(['help'], cliEnv());

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('rename');
    });
  });
});
