import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { listFullCommand } from '../../src/commands.js';

describe('listFullCommand', () => {
  let tempDir;
  let storePath;
  let npmrcPath;
  let store;

  beforeEach(async () => {
    tempDir = await createTempDir();
    storePath = join(tempDir, '.nrs');
    npmrcPath = join(tempDir, '.npmrc');
    store = createProfileStore({ storePath, npmrcPath });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('returns empty string when no profiles exist', async () => {
    const output = await listFullCommand(store);
    expect(output).toBe('');
  });

  it('displays profile names with registry URLs in brackets', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'work'), 'registry=https://registry.work.com/\n');
    await writeFile(join(storePath, 'oss'), 'registry=https://registry.npmjs.org/\n');

    const output = await listFullCommand(store);
    const lines = output.split('\n');

    expect(lines).toEqual([
      '  oss [https://registry.npmjs.org/]',
      '  work [https://registry.work.com/]',
    ]);
  });

  it('marks active profile with asterisk', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'work'), 'registry=https://registry.work.com/\n');
    await writeFile(join(storePath, 'oss'), 'registry=https://registry.npmjs.org/\n');
    await writeFile(join(storePath, '.active'), 'work');

    const output = await listFullCommand(store);
    const lines = output.split('\n');

    expect(lines).toEqual([
      '  oss [https://registry.npmjs.org/]',
      '* work [https://registry.work.com/]',
    ]);
  });

  it('handles profiles without a registry line', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'empty'), '# no registry here\n');
    await writeFile(join(storePath, 'work'), 'registry=https://registry.work.com/\n');

    const output = await listFullCommand(store);
    const lines = output.split('\n');

    expect(lines).toEqual([
      '  empty',
      '  work [https://registry.work.com/]',
    ]);
  });

  it('handles profiles with multiple lines and extracts registry', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(
      join(storePath, 'full'),
      'registry=https://private.registry.io/\n//private.registry.io/:_authToken=token123\nalways-auth=true\n'
    );

    const output = await listFullCommand(store);

    expect(output).toBe('  full [https://private.registry.io/]');
  });

  it('sorts profiles alphabetically', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'zulu'), 'registry=https://z.example.com/\n');
    await writeFile(join(storePath, 'alpha'), 'registry=https://a.example.com/\n');
    await writeFile(join(storePath, 'mike'), 'registry=https://m.example.com/\n');

    const output = await listFullCommand(store);
    const lines = output.split('\n');

    expect(lines[0]).toContain('alpha');
    expect(lines[1]).toContain('mike');
    expect(lines[2]).toContain('zulu');
  });
});
