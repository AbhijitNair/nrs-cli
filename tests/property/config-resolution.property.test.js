import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig } from '../../src/config-resolver.js';

/**
 * Property 8: Configuration resolution from environment variables
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 *
 * - For any non-empty string value assigned to NRS_STORE, the resolved config uses that value as the store path
 * - For any non-empty string value assigned to NRS_NPMRC, the resolved config uses that value as the npmrc path
 * - When either variable is unset or empty, the corresponding default path is used
 */

/**
 * Generates a random subdirectory name suitable for appending to tmpdir.
 * Uses alphanumeric characters to ensure valid path segments on all platforms.
 */
const validSubdirName = fc.string({
  unit: fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split(''),
  ),
  minLength: 1,
  maxLength: 30,
});

/**
 * Generates a valid path under os.tmpdir() by appending a random subdirectory name.
 * This ensures the parent directory (tmpdir) is always accessible for validation.
 */
const validTmpPath = validSubdirName.map((subdir) => path.join(os.tmpdir(), subdir));

describe('Feature: npm-registry-switcher, Property 8: Configuration resolution from environment variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NRS_STORE;
    delete process.env.NRS_NPMRC;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * **Validates: Requirements 6.1**
   * For any non-empty string value assigned to NRS_STORE,
   * the resolved config uses that value as the store path.
   */
  it('should use NRS_STORE env var value as store path for any valid non-empty path', () => {
    fc.assert(
      fc.property(validTmpPath, (storePath) => {
        process.env.NRS_STORE = storePath;
        delete process.env.NRS_NPMRC;

        const config = resolveConfig();
        expect(config.storePath).toBe(path.resolve(storePath));
      }),
      { numRuns: 30 },
    );
  });

  /**
   * **Validates: Requirements 6.2**
   * For any non-empty string value assigned to NRS_NPMRC,
   * the resolved config uses that value as the npmrc path.
   */
  it('should use NRS_NPMRC env var value as npmrc path for any valid non-empty path', () => {
    fc.assert(
      fc.property(validTmpPath, (npmrcPath) => {
        delete process.env.NRS_STORE;
        process.env.NRS_NPMRC = npmrcPath;

        const config = resolveConfig();
        expect(config.npmrcPath).toBe(path.resolve(npmrcPath));
      }),
      { numRuns: 30 },
    );
  });

  /**
   * **Validates: Requirements 6.3**
   * When NRS_STORE is unset or empty, the default store path (~/.nrs/) is used.
   */
  it('should use default store path when NRS_STORE is unset or empty', () => {
    const emptyOrUnset = fc.oneof(
      fc.constant(undefined),
      fc.constant(''),
      fc.constant('   '),
      fc.constant('\t'),
      fc.constant('  \t  '),
    );

    fc.assert(
      fc.property(emptyOrUnset, (envValue) => {
        if (envValue === undefined) {
          delete process.env.NRS_STORE;
        } else {
          process.env.NRS_STORE = envValue;
        }
        delete process.env.NRS_NPMRC;

        const config = resolveConfig();
        const expectedDefault = path.join(os.homedir(), '.nrs');
        expect(config.storePath).toBe(expectedDefault);
      }),
      { numRuns: 30 },
    );
  });

  /**
   * **Validates: Requirements 6.4**
   * When NRS_NPMRC is unset or empty, the default npmrc path (~/.npmrc) is used.
   */
  it('should use default npmrc path when NRS_NPMRC is unset or empty', () => {
    const emptyOrUnset = fc.oneof(
      fc.constant(undefined),
      fc.constant(''),
      fc.constant('   '),
      fc.constant('\t'),
      fc.constant('  \t  '),
    );

    fc.assert(
      fc.property(emptyOrUnset, (envValue) => {
        delete process.env.NRS_STORE;
        if (envValue === undefined) {
          delete process.env.NRS_NPMRC;
        } else {
          process.env.NRS_NPMRC = envValue;
        }

        const config = resolveConfig();
        const expectedDefault = path.join(os.homedir(), '.npmrc');
        expect(config.npmrcPath).toBe(expectedDefault);
      }),
      { numRuns: 30 },
    );
  });

  /**
   * **Validates: Requirements 6.1, 6.2**
   * Both NRS_STORE and NRS_NPMRC can be set simultaneously and independently resolved.
   */
  it('should resolve both env vars independently when both are set', () => {
    fc.assert(
      fc.property(validTmpPath, validTmpPath, (storePath, npmrcPath) => {
        process.env.NRS_STORE = storePath;
        process.env.NRS_NPMRC = npmrcPath;

        const config = resolveConfig();
        expect(config.storePath).toBe(path.resolve(storePath));
        expect(config.npmrcPath).toBe(path.resolve(npmrcPath));
      }),
      { numRuns: 30 },
    );
  });
});
