import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore, NpmrcManager } from '../../src/store.js';
import { createProfileSwitcher } from '../../src/profile-switcher.js';
import { useCommand } from '../../src/commands.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';

describe('use command integration', () => {
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

  it('switches to exact match profile and updates npmrc content', async () => {
    const profileContent = 'registry=https://work.example.com/\n//work.example.com/:_authToken=token123\n';
    await writeFile(join(storePath, 'work'), profileContent);

    const result = await useCommand(switcher, 'work');

    expect(result.message).toBe("Switched to profile 'work'");
    const npmrcContent = await readFile(npmrcPath, 'utf-8');
    expect(npmrcContent).toBe(profileContent);
  });

  it('switches to prefix match profile when only one matches', async () => {
    const profileContent = 'registry=https://production.example.com/\n';
    await writeFile(join(storePath, 'production'), profileContent);

    const result = await useCommand(switcher, 'prod');

    expect(result.message).toBe("Switched to profile 'production'");
    expect(result.warning).toContain('prefix');
    expect(result.warning).toContain('production');
    const npmrcContent = await readFile(npmrcPath, 'utf-8');
    expect(npmrcContent).toBe(profileContent);
  });

  it('returns error for ambiguous prefix match when multiple profiles match', async () => {
    await writeFile(join(storePath, 'prod-east'), 'registry=https://east.example.com/\n');
    await writeFile(join(storePath, 'prod-west'), 'registry=https://west.example.com/\n');

    try {
      await useCommand(switcher, 'prod');
      expect.fail('Expected NrsError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.AMBIGUOUS_MATCH);
      expect(err.message).toContain('Ambiguous');
      expect(err.message).toContain('prod-east');
      expect(err.message).toContain('prod-west');
    }
  });

  it('returns error when no profile matches', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'personal'), 'registry=https://personal.example.com/\n');

    try {
      await useCommand(switcher, 'staging');
      expect.fail('Expected NrsError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_NOT_FOUND);
      expect(err.message).toContain('not found');
    }
  });

  it('updates active profile metadata after switch', async () => {
    await writeFile(join(storePath, 'work'), 'registry=https://work.example.com/\n');
    await writeFile(join(storePath, 'personal'), 'registry=https://personal.example.com/\n');

    await useCommand(switcher, 'work');

    const activeName = await store.getActiveProfileName();
    expect(activeName).toBe('work');

    // Switch again and verify active updates
    await useCommand(switcher, 'personal');

    const newActiveName = await store.getActiveProfileName();
    expect(newActiveName).toBe('personal');
  });

  it('verifies npmrc content is byte-for-byte identical to profile content', async () => {
    // Use content with various characters to ensure exact byte matching
    const profileContent = 'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=npm_abc123XYZ\nalways-auth=true\n';
    await writeFile(join(storePath, 'default'), profileContent);

    await useCommand(switcher, 'default');

    const npmrcBuffer = await npmrcManager.read();
    const profileBuffer = Buffer.from(profileContent);
    expect(npmrcBuffer).not.toBeNull();
    expect(npmrcBuffer.equals(profileBuffer)).toBe(true);
  });

  it('aborts switch in non-interactive mode when npmrc is externally modified', async () => {
    const originalContent = 'registry=https://work.example.com/\n';
    const modifiedContent = 'registry=https://hacked.example.com/\n';
    const targetContent = 'registry=https://personal.example.com/\n';

    // Set up active profile and matching npmrc
    await writeFile(join(storePath, 'work'), originalContent);
    await writeFile(join(storePath, 'personal'), targetContent);
    await writeFile(join(storePath, '.active'), 'work');
    // Simulate external modification of npmrc
    await writeFile(npmrcPath, modifiedContent);

    try {
      await useCommand(switcher, 'personal');
      expect.fail('Expected NrsError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.SWITCH_ABORTED);
      expect(err.message).toContain('externally modified');
    }

    // Verify npmrc was NOT overwritten
    const npmrcContent = await readFile(npmrcPath, 'utf-8');
    expect(npmrcContent).toBe(modifiedContent);
  });

  it('proceeds without prompt when npmrc matches active profile (no external modification)', async () => {
    const profileContent = 'registry=https://work.example.com/\n';
    const targetContent = 'registry=https://personal.example.com/\n';

    // Set up active profile with matching npmrc content
    await writeFile(join(storePath, 'work'), profileContent);
    await writeFile(join(storePath, 'personal'), targetContent);
    await writeFile(join(storePath, '.active'), 'work');
    await writeFile(npmrcPath, profileContent);

    // Should succeed without prompting since npmrc matches active profile
    const result = await useCommand(switcher, 'personal');

    expect(result.message).toBe("Switched to profile 'personal'");
    const npmrcContent = await readFile(npmrcPath, 'utf-8');
    expect(npmrcContent).toBe(targetContent);
  });
});
