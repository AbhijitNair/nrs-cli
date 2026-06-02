import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validProfileName, registryUrl } from '../helpers/generators.js';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import { createProfileStore } from '../../src/store.js';

/**
 * Property 5: Profile set round-trip
 * Validates: Requirements 3.1, 3.2
 *
 * For any valid profile name and any registry URL string, after invoking
 * writeProfile on the store with content `registry=<url>`, reading the profile
 * from the store SHALL yield content containing exactly `registry=<url>`.
 */
describe('Feature: npm-registry-switcher, Property 5: Profile set round-trip', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   */
  it('should round-trip any valid profile name and registry URL through writeProfile/getProfile', async () => {
    await fc.assert(
      fc.asyncProperty(validProfileName, registryUrl, async (name, url) => {
        const tempDir = await createTempDir();
        try {
          const store = createProfileStore({ storePath: tempDir, npmrcPath: '' });
          await store.ensureStoreExists();

          const content = `registry=${url}\n`;
          await store.writeProfile(name, content);

          const result = await store.getProfile(name);
          expect(result).toBe(content);
        } finally {
          await cleanupTempDir(tempDir);
        }
      }),
      { numRuns: 30 },
    );
  });
});
