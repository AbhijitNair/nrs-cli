import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createProfileStore } from '../../src/store.js';
import { listCommand } from '../../src/commands.js';
import { validProfileName, profileContent } from '../helpers/generators.js';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';

/**
 * Feature: npm-registry-switcher, Property 1: Profile listing is sorted and marks active
 *
 * **Validates: Requirements 1.1, 1.2, 1.6**
 *
 * For any set of profile names in the store and any active profile name (or none),
 * listing profiles SHALL return all names in alphabetical order with exactly the
 * active profile prefixed by an asterisk (or no asterisk if no active profile is set).
 */
describe('Feature: npm-registry-switcher, Property 1: Profile listing is sorted and marks active', () => {
  it('SHALL return all profile names sorted alphabetically with the active profile marked by asterisk', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(validProfileName, { minLength: 1, maxLength: 10 }),
        fc.boolean(),
        async (profileNames, hasActive) => {
          const tempDir = await createTempDir();
          try {
            const store = createProfileStore({ storePath: tempDir, npmrcPath: '' });
            await store.ensureStoreExists();

            // Write all profiles
            for (const name of profileNames) {
              await store.writeProfile(name, `registry=https://example.com/\n`);
            }

            // Optionally set one as active
            const activeIndex = hasActive ? Math.floor(Math.random() * profileNames.length) : -1;
            const activeName = activeIndex >= 0 ? profileNames[activeIndex] : null;
            if (activeName) {
              await store.setActiveProfileName(activeName);
            }

            // Call listCommand
            const output = await listCommand(store);
            const lines = output.split('\n');

            // Verify: output has exactly as many lines as profiles
            expect(lines.length).toBe(profileNames.length);

            // Extract names from lines (strip prefix)
            const extractedNames = lines.map((line) => {
              if (line.startsWith('* ')) {
                return line.slice(2);
              }
              return line.trim();
            });

            // Verify: output lines are sorted alphabetically
            const sorted = [...extractedNames].sort();
            expect(extractedNames).toEqual(sorted);

            // Verify: all profile names are present
            expect(new Set(extractedNames)).toEqual(new Set(profileNames));

            // Verify: exactly one line has "* " prefix (the active one) or none
            const starredLines = lines.filter((line) => line.startsWith('* '));
            if (activeName) {
              expect(starredLines.length).toBe(1);
              expect(starredLines[0]).toBe(`* ${activeName}`);
            } else {
              expect(starredLines.length).toBe(0);
            }
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('SHALL return an empty string when no profiles exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const tempDir = await createTempDir();
          try {
            const store = createProfileStore({ storePath: tempDir, npmrcPath: '' });
            await store.ensureStoreExists();

            const output = await listCommand(store);
            expect(output).toBe('');
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('SHALL display no asterisk marker when no active profile is set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(validProfileName, { minLength: 1, maxLength: 10 }),
        async (profileNames) => {
          const tempDir = await createTempDir();
          try {
            const store = createProfileStore({ storePath: tempDir, npmrcPath: '' });
            await store.ensureStoreExists();

            // Write profiles without setting any as active
            for (const name of profileNames) {
              await store.writeProfile(name, `registry=https://example.com/\n`);
            }

            const output = await listCommand(store);
            const lines = output.split('\n');

            // Verify: no line has "* " prefix
            const starredLines = lines.filter((line) => line.startsWith('* '));
            expect(starredLines.length).toBe(0);

            // Verify: all lines are indented with "  " prefix
            for (const line of lines) {
              expect(line.startsWith('  ')).toBe(true);
            }
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
