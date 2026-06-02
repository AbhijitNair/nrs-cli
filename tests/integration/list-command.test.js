import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';
import { listCommand } from '../../src/commands.js';

describe('list command integration', () => {
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

  it('lists multiple profiles sorted alphabetically', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'zulu'), 'registry=https://zulu.example.com/');
    await writeFile(join(storePath, 'alpha'), 'registry=https://alpha.example.com/');
    await writeFile(join(storePath, 'mike'), 'registry=https://mike.example.com/');
    await writeFile(join(storePath, 'bravo'), 'registry=https://bravo.example.com/');

    const output = await listCommand(store);
    const lines = output.split('\n');

    expect(lines).toEqual([
      '  alpha',
      '  bravo',
      '  mike',
      '  zulu',
    ]);
  });

  it('marks active profile with "* " prefix', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'default'), 'registry=https://registry.npmjs.org/');
    await writeFile(join(storePath, 'staging'), 'registry=https://staging.example.com/');
    await writeFile(join(storePath, 'production'), 'registry=https://prod.example.com/');
    await writeFile(join(storePath, '.active'), 'staging');

    const output = await listCommand(store);
    const lines = output.split('\n');

    expect(lines).toEqual([
      '  default',
      '  production',
      '* staging',
    ]);
  });

  it('creates store directory if it does not exist', async () => {
    // storePath does not exist yet
    await listCommand(store);

    const entries = await readdir(tempDir);
    expect(entries).toContain('.nrs');

    const storeEntries = await readdir(storePath);
    // Store was created (may be empty or contain default from npmrc)
    expect(storeEntries).toBeDefined();
  });

  it('copies existing .npmrc as "default" profile when store is new', async () => {
    const npmrcContent = 'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=secret123\n';
    await writeFile(npmrcPath, npmrcContent);

    const output = await listCommand(store);

    // Should have created a "default" profile from the existing .npmrc
    expect(output).toBe('  default');

    // Verify the profile content matches the original .npmrc
    const profileContent = await store.getProfile('default');
    expect(profileContent).toBe(npmrcContent);
  });

  it('returns empty output when store has no profiles', async () => {
    await mkdir(storePath, { recursive: true });
    // Store exists but has no profile files

    const output = await listCommand(store);

    expect(output).toBe('');
  });

  it('displays profiles without asterisk when no active profile is set', async () => {
    await mkdir(storePath, { recursive: true });
    await writeFile(join(storePath, 'personal'), 'registry=https://personal.example.com/');
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/');
    await writeFile(join(storePath, 'oss'), 'registry=https://oss.example.com/');
    // No .active file written

    const output = await listCommand(store);
    const lines = output.split('\n');

    expect(lines).toEqual([
      '  oss',
      '  personal',
      '  work',
    ]);
    // Verify no line starts with "* "
    expect(lines.every((line) => line.startsWith('  '))).toBe(true);
  });
});
