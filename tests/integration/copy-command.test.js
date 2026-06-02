import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readdir } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { copyCommand } from '../../src/commands.js';
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

describe('copy command integration', () => {
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

  it('copies an existing profile and verifies content is preserved at both locations', async () => {
    const content = 'registry=https://work.example.com/\n';
    await writeFile(join(storePath, 'work'), content);

    const result = await copyCommand(store, 'work', 'work-backup', {
      isInteractive: () => false,
    });

    expect(result.message).toBe("Copied profile 'work' to 'work-backup'");
    expect(await store.profileExists('work')).toBe(true);
    expect(await store.profileExists('work-backup')).toBe(true);
    expect(await store.getProfile('work')).toBe(content);
    expect(await store.getProfile('work-backup')).toBe(content);
  });

  it('does not affect active marker when copying the active profile', async () => {
    await writeFile(join(storePath, 'dev'), 'registry=https://dev.example.com/\n');
    await writeFile(join(storePath, '.active'), 'dev');

    await copyCommand(store, 'dev', 'dev-copy', {
      isInteractive: () => false,
    });

    expect(await store.getActiveProfileName()).toBe('dev');
  });

  it('does not affect active marker when copying a non-active profile', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'personal'), 'registry=https://personal.example.com/\n');
    await writeFile(join(storePath, '.active'), 'personal');

    await copyCommand(store, 'work', 'work-copy', {
      isInteractive: () => false,
    });

    expect(await store.getActiveProfileName()).toBe('personal');
  });

  it('throws PROFILE_NOT_FOUND when source does not exist', async () => {
    try {
      await copyCommand(store, 'ghost', 'target', {
        isInteractive: () => false,
      });
      expect.fail('Expected copyCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_NOT_FOUND);
      expect(err.message).toContain('ghost');
    }
  });

  it('throws MISSING_ARGUMENT when source name is empty', async () => {
    try {
      await copyCommand(store, '', 'target', {
        isInteractive: () => false,
      });
      expect.fail('Expected copyCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws MISSING_ARGUMENT when target name is empty', async () => {
    try {
      await copyCommand(store, 'work', '', {
        isInteractive: () => false,
      });
      expect.fail('Expected copyCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws PROFILE_EXISTS when destination exists in non-interactive mode', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'backup'), 'registry=https://backup.example.com/\n');

    try {
      await copyCommand(store, 'work', 'backup', {
        isInteractive: () => false,
      });
      expect.fail('Expected copyCommand to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_EXISTS);
      expect(err.message).toContain('backup');
    }
  });

  it('source profile remains unchanged after copy', async () => {
    const content = 'registry=https://work.example.com/\n';
    await writeFile(join(storePath, 'work'), content);

    await copyCommand(store, 'work', 'work-copy', {
      isInteractive: () => false,
    });

    expect(await store.getProfile('work')).toBe(content);
    const entries = await readdir(storePath);
    expect(entries).toContain('work');
    expect(entries).toContain('work-copy');
  });

  describe('CLI invocation', () => {
    function cliEnv() {
      return { NRS_STORE: storePath, NRS_NPMRC: npmrcPath };
    }

    it('copies a profile via CLI end-to-end', async () => {
      await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');

      const result = await runCli(['copy', 'work', 'work-backup'], cliEnv());

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Copied profile 'work' to 'work-backup'");

      // Verify file system state
      const entries = await readdir(storePath);
      expect(entries).toContain('work');
      expect(entries).toContain('work-backup');
    });

    it('outputs error for non-existent source profile', async () => {
      const result = await runCli(['copy', 'ghost', 'target'], cliEnv());

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('ghost');
    });

    it('outputs error when missing arguments', async () => {
      const result = await runCli(['copy'], cliEnv());

      expect(result.exitCode).toBe(1);
    });

    it('nrs help includes copy command', async () => {
      const result = await runCli(['help'], cliEnv());

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('copy');
    });
  });
});
