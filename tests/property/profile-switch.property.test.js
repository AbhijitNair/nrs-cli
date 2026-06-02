import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createProfileStore, NpmrcManager } from '../../src/store.js';
import { createProfileSwitcher } from '../../src/profile-switcher.js';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { validProfileName, profileContent } from '../helpers/generators.js';

/**
 * Property 3: Profile switch round-trip
 * Validates: Requirements 2.1
 *
 * For any valid profile with arbitrary content, after switching to that profile
 * via the ProfileSwitcher, the Npmrc_File SHALL contain content byte-for-byte
 * identical to the profile's stored content, and the active profile metadata
 * SHALL record that profile's name.
 */
describe('Feature: npm-registry-switcher, Property 3: Profile switch round-trip', () => {
  it('should write profile content byte-for-byte to npmrc and record active profile name after switch', async () => {
    await fc.assert(
      fc.asyncProperty(validProfileName, profileContent, async (name, content) => {
        const tempDir = await createTempDir();
        try {
          const storePath = join(tempDir, 'store');
          const npmrcPath = join(tempDir, '.npmrc');

          const profileStore = createProfileStore({ storePath, npmrcPath });
          const npmrcManager = new NpmrcManager(npmrcPath);
          const profileSwitcher = createProfileSwitcher({
            profileStore,
            npmrcManager,
            isInteractive: () => false,
          });

          // Ensure store directory exists
          await profileStore.ensureStoreExists();

          // Write the profile to the store
          await profileStore.writeProfile(name, content);

          // Switch to the profile (force to skip protection checks)
          const result = await profileSwitcher.switchTo(name, { force: true });

          // Verify switch was successful
          expect(result.success).toBe(true);
          expect(result.switched).toBe(name);

          // Verify: npmrc file content is byte-for-byte identical to profile content
          const npmrcContent = await readFile(npmrcPath, 'utf-8');
          expect(npmrcContent).toBe(content);

          // Verify: active profile metadata records the profile name
          const activeProfile = await profileStore.getActiveProfileName();
          expect(activeProfile).toBe(name);
        } finally {
          await cleanupTempDir(tempDir);
        }
      }),
      { numRuns: 30 },
    );
  });
});
