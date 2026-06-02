import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';

const execAsync = promisify(exec);

const CLI_PATH = join(process.cwd(), 'src', 'cli.js');

/**
 * Runs the CLI with the given arguments and environment overrides.
 */
async function runCli(args, env) {
  const mergedEnv = {
    ...process.env,
    ...env,
  };

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

describe('CLI Interface Integration Tests', () => {
  let storePath;
  let npmrcPath;
  let npmrcDir;

  beforeEach(async () => {
    storePath = await createTempDir('nrs-cli-store-');
    npmrcDir = await createTempDir('nrs-cli-npmrc-');
    npmrcPath = join(npmrcDir, '.npmrc');
  });

  afterEach(async () => {
    await cleanupTempDir(storePath);
    await cleanupTempDir(npmrcDir);
  });

  function cliEnv() {
    return {
      NRS_STORE: storePath,
      NRS_NPMRC: npmrcPath,
    };
  }

  describe('--version flag', () => {
    it('outputs version in semver format and exits with code 0', async () => {
      const result = await runCli(['--version'], cliEnv());

      expect(result.exitCode).toBe(0);
      // Semver format: MAJOR.MINOR.PATCH
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('no arguments (default help)', () => {
    it('outputs help text and exits with code 0', async () => {
      const result = await runCli([], cliEnv());

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('nrs');
      expect(result.stdout).toContain('Commands:');
    });
  });

  describe('help command', () => {
    it('outputs help text and exits with code 0', async () => {
      const result = await runCli(['help'], cliEnv());

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('nrs');
      expect(result.stdout).toContain('Commands:');
    });

    it('contains all command names', async () => {
      const result = await runCli(['help'], cliEnv());

      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('use');
      expect(result.stdout).toContain('set');
      expect(result.stdout).toContain('delete');
      expect(result.stdout).toContain('rename');
      expect(result.stdout).toContain('copy');
      expect(result.stdout).toContain('help');
    });

    it('contains --version flag', async () => {
      const result = await runCli(['help'], cliEnv());

      expect(result.stdout).toContain('--version');
    });
  });

  describe('unrecognized command', () => {
    it('outputs error with suggestion and exits with code 1', async () => {
      const result = await runCli(['lst'], cliEnv());

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('lst');
      // Should suggest 'list' as closest match
      expect(result.stderr.toLowerCase()).toContain('list');
    });

    it('shows error for completely unknown command', async () => {
      const result = await runCli(['unknowncommand'], cliEnv());

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('unknowncommand');
    });
  });

  describe('list command with empty store', () => {
    it('exits with code 0', async () => {
      // Ensure store directory exists but is empty
      await mkdir(storePath, { recursive: true });

      const result = await runCli(['list'], cliEnv());

      expect(result.exitCode).toBe(0);
    });
  });
});
