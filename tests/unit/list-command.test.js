import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { listCommand } from '../../src/commands.js';

describe('listCommand', () => {
  let tempDir;
  let storePath;
  let npmrcPath;
  let store;

  beforeEach(async () => {
    tempDir = await createTempDir();
    storePath = join(tempDir, '.nrs');
    npmrcPath = join(tempDir, '.npmrc');
    const config = { storePath, npmrcPath };
    store = createProfileStore(config);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('returns empty string when no profiles exist', async () => {
    const output = await listCommand(store);
    expect(output).toBe('');
  });

  it('lists profiles sorted alphabetically', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/');
    await writeFile(join(storePath, 'default'), 'registry=https://registry.npmjs.org/');
    await writeFile(join(storePath, 'alpha'), 'registry=https://alpha.example.com/');

    const output = await listCommand(store);
    const lines = output.split('\n');
    expect(lines).toEqual([
      '  alpha',
      '  default',
      '  work',
    ]);
  });

  it('prefixes active profile with "* "', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'default'), 'registry=https://registry.npmjs.org/');
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/');
    await writeFile(join(storePath, '.active'), 'work');

    const output = await listCommand(store);
    const lines = output.split('\n');
    expect(lines).toEqual([
      '  default',
      '* work',
    ]);
  });

  it('displays all profiles without asterisk when no active profile is set', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'default'), 'content');
    await writeFile(join(storePath, 'work'), 'content');

    const output = await listCommand(store);
    const lines = output.split('\n');
    expect(lines).toEqual([
      '  default',
      '  work',
    ]);
  });

  it('creates the store directory if it does not exist', async () => {
    // Store doesn't exist yet, listCommand should call ensureStoreExists
    const output = await listCommand(store);
    expect(output).toBe('');

    // Verify store was created
    const { stat } = await import('node:fs/promises');
    const stats = await stat(storePath);
    expect(stats.isDirectory()).toBe(true);
  });

  it('copies existing .npmrc as default profile when store is new', async () => {
    const npmrcContent = 'registry=https://registry.npmjs.org/\n';
    await writeFile(npmrcPath, npmrcContent);

    const output = await listCommand(store);
    const lines = output.split('\n');
    expect(lines).toEqual(['  default']);
  });

  it('handles single profile correctly', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'only-one'), 'content');
    await writeFile(join(storePath, '.active'), 'only-one');

    const output = await listCommand(store);
    expect(output).toBe('* only-one');
  });
});
