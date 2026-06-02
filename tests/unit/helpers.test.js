import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createTempDir, cleanupTempDir } from '../helpers/test-fs.js';
import {
  validProfileName,
  invalidProfileName,
  registryUrl,
  profileContent,
  arbitraryBuffer,
} from '../helpers/generators.js';
import { existsSync } from 'node:fs';

describe('test-fs helpers', () => {
  it('creates and cleans up a temp directory', async () => {
    const dir = await createTempDir();
    expect(existsSync(dir)).toBe(true);
    await cleanupTempDir(dir);
    expect(existsSync(dir)).toBe(false);
  });
});

describe('fast-check generators', () => {
  it('validProfileName generates names matching /^[a-zA-Z0-9_-]+$/ with length 1-64', () => {
    fc.assert(
      fc.property(validProfileName, (name) => {
        expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
        expect(name.length).toBeGreaterThanOrEqual(1);
        expect(name.length).toBeLessThanOrEqual(64);
      }),
      { numRuns: 100 },
    );
  });

  it('invalidProfileName generates names that violate profile name rules', () => {
    fc.assert(
      fc.property(invalidProfileName, (name) => {
        const isValid = /^[a-zA-Z0-9_-]{1,64}$/.test(name);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('registryUrl generates valid https URLs', () => {
    fc.assert(
      fc.property(registryUrl, (url) => {
        expect(url).toMatch(/^https:\/\/.+\/$/);
      }),
      { numRuns: 100 },
    );
  });

  it('profileContent generates registry=<url> lines', () => {
    fc.assert(
      fc.property(profileContent, (content) => {
        expect(content).toMatch(/^registry=https:\/\/.+\/\n$/);
      }),
      { numRuns: 100 },
    );
  });

  it('arbitraryBuffer generates Buffer instances', () => {
    fc.assert(
      fc.property(arbitraryBuffer, (buf) => {
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(buf.length).toBeGreaterThanOrEqual(0);
        expect(buf.length).toBeLessThanOrEqual(512);
      }),
      { numRuns: 100 },
    );
  });
});
