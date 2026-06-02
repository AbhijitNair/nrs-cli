import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { resolveConfig } from '../../src/config-resolver.js';
import { ErrorCodes } from '../../src/errors.js';

describe('ConfigResolver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NRS_STORE;
    delete process.env.NRS_NPMRC;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('default paths', () => {
    it('should use ~/.nrs/ as default store path', () => {
      const config = resolveConfig();
      const expected = path.join(os.homedir(), '.nrs');
      expect(config.storePath).toBe(expected);
    });

    it('should use ~/.npmrc as default npmrc path', () => {
      const config = resolveConfig();
      const expected = path.join(os.homedir(), '.npmrc');
      expect(config.npmrcPath).toBe(expected);
    });
  });

  describe('environment variable overrides', () => {
    it('should use NRS_STORE env var when set to a valid path', () => {
      const tempDir = os.tmpdir();
      const storePath = path.join(tempDir, 'custom-nrs-store');
      process.env.NRS_STORE = storePath;

      const config = resolveConfig();
      expect(config.storePath).toBe(path.resolve(storePath));
    });

    it('should use NRS_NPMRC env var when set to a valid path', () => {
      const tempDir = os.tmpdir();
      const npmrcPath = path.join(tempDir, 'custom-npmrc');
      process.env.NRS_NPMRC = npmrcPath;

      const config = resolveConfig();
      expect(config.npmrcPath).toBe(path.resolve(npmrcPath));
    });

    it('should ignore empty NRS_STORE and use default', () => {
      process.env.NRS_STORE = '';
      const config = resolveConfig();
      const expected = path.join(os.homedir(), '.nrs');
      expect(config.storePath).toBe(expected);
    });

    it('should ignore whitespace-only NRS_STORE and use default', () => {
      process.env.NRS_STORE = '   ';
      const config = resolveConfig();
      const expected = path.join(os.homedir(), '.nrs');
      expect(config.storePath).toBe(expected);
    });

    it('should ignore empty NRS_NPMRC and use default', () => {
      process.env.NRS_NPMRC = '';
      const config = resolveConfig();
      const expected = path.join(os.homedir(), '.npmrc');
      expect(config.npmrcPath).toBe(expected);
    });

    it('should ignore whitespace-only NRS_NPMRC and use default', () => {
      process.env.NRS_NPMRC = '   ';
      const config = resolveConfig();
      const expected = path.join(os.homedir(), '.npmrc');
      expect(config.npmrcPath).toBe(expected);
    });
  });

  describe('error handling', () => {
    it('should throw HOME_DIR_ERROR when homedir cannot be resolved', () => {
      vi.spyOn(os, 'homedir').mockImplementation(() => {
        throw new Error('Cannot determine home directory');
      });

      expect(() => resolveConfig()).toThrow(
        expect.objectContaining({
          code: ErrorCodes.HOME_DIR_ERROR,
        })
      );
    });

    it('should throw HOME_DIR_ERROR when homedir returns empty string', () => {
      vi.spyOn(os, 'homedir').mockReturnValue('');

      expect(() => resolveConfig()).toThrow(
        expect.objectContaining({
          code: ErrorCodes.HOME_DIR_ERROR,
        })
      );
    });

    it('should throw INVALID_PATH when NRS_STORE parent directory is not accessible', () => {
      process.env.NRS_STORE = '/nonexistent-root-xyz/deeply/nested/store';

      expect(() => resolveConfig()).toThrow(
        expect.objectContaining({
          code: ErrorCodes.INVALID_PATH,
        })
      );
    });

    it('should throw INVALID_PATH when NRS_NPMRC parent directory is not accessible', () => {
      process.env.NRS_NPMRC = '/nonexistent-root-xyz/deeply/nested/npmrc';

      expect(() => resolveConfig()).toThrow(
        expect.objectContaining({
          code: ErrorCodes.INVALID_PATH,
        })
      );
    });

    it('should include env var name in INVALID_PATH error details', () => {
      process.env.NRS_STORE = '/nonexistent-root-xyz/store';

      try {
        resolveConfig();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code).toBe(ErrorCodes.INVALID_PATH);
        expect(err.details?.envVar).toBe('NRS_STORE');
        expect(err.message).toContain('NRS_STORE');
      }
    });
  });
});
