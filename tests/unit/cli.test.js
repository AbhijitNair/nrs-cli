import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';

const execFileAsync = promisify(execFile);

const CLI_PATH = join(process.cwd(), 'src', 'cli.js');

async function runCli(args, env) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.code || 1,
    };
  }
}

describe('CLI command routing', () => {
  let storePath;
  let npmrcPath;

  beforeEach(async () => {
    storePath = await createTempDir('nrs-cli-test-store-');
    npmrcPath = join(await createTempDir('nrs-cli-test-npmrc-'), '.npmrc');
  });

  afterEach(async () => {
    await cleanupTempDir(storePath);
    await cleanupTempDir(join(npmrcPath, '..'));
  });

  function cliEnv() {
    return {
      NRS_STORE: storePath,
      NRS_NPMRC: npmrcPath,
    };
  }

  describe('--version flag', () => {
    it('outputs version in semver format', async () => {
      const result = await runCli(['--version'], cliEnv());
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('no arguments (defaults to help)', () => {
    it('displays help output when invoked with no arguments', async () => {
      const result = await runCli([], cliEnv());
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('nrs');
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Commands:');
    });
  });

  describe('help command', () => {
    it('displays help output', async () => {
      const result = await runCli(['help'], cliEnv());
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('nrs');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('use');
      expect(result.stdout).toContain('delete');
      expect(result.stdout).toContain('help');
      expect(result.stdout).toContain('--version');
    });
  });

  describe('unrecognized command', () => {
    it('displays error with suggestion for similar command', async () => {
      const result = await runCli(['lst'], cliEnv());
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown command');
      expect(result.stderr).toContain('lst');
      expect(result.stderr).toContain('list');
    });

    it('displays error for completely unrecognized command', async () => {
      const result = await runCli(['foobar'], cliEnv());
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown command');
      expect(result.stderr).toContain('foobar');
    });
  });

  describe('list command dispatch', () => {
    it('dispatches to list command and exits with code 0', async () => {
      const result = await runCli(['list'], cliEnv());
      expect(result.exitCode).toBe(0);
    });

    it('shows profiles when store has profiles', async () => {
      // Create a profile in the store
      await writeFile(join(storePath, 'work'), 'registry=https://registry.npmjs.org/\n');
      const result = await runCli(['list'], cliEnv());
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('work');
    });
  });

  describe('delete command dispatch', () => {
    it('dispatches to delete command with profile argument', async () => {
      // Create a profile to delete
      await writeFile(join(storePath, 'temp-profile'), 'registry=https://example.com/\n');
      const result = await runCli(['delete', 'temp-profile'], cliEnv());
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Deleted');
      expect(result.stdout).toContain('temp-profile');
    });

    it('exits with code 1 when profile does not exist', async () => {
      // Ensure store directory exists
      await mkdir(storePath, { recursive: true });
      const result = await runCli(['delete', 'nonexistent'], cliEnv());
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });

  describe('use command dispatch', () => {
    it('dispatches to use command with profile argument', async () => {
      // Create a profile to use
      await writeFile(join(storePath, 'myprofile'), 'registry=https://registry.npmjs.org/\n');
      const result = await runCli(['use', 'myprofile'], cliEnv());
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Switched to profile');
      expect(result.stdout).toContain('myprofile');
    });

    it('exits with code 1 when profile does not exist', async () => {
      await mkdir(storePath, { recursive: true });
      const result = await runCli(['use', 'nonexistent'], cliEnv());
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error:');
    });
  });

  describe('exit codes', () => {
    it('exits with code 0 for successful commands', async () => {
      const result = await runCli(['list'], cliEnv());
      expect(result.exitCode).toBe(0);
    });

    it('exits with code 1 for error commands', async () => {
      await mkdir(storePath, { recursive: true });
      const result = await runCli(['use', 'nonexistent'], cliEnv());
      expect(result.exitCode).toBe(1);
    });
  });
});
