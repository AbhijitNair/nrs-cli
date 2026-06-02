import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkProtection } from '../../src/utils.js';
import { arbitraryBuffer } from '../helpers/generators.js';

/**
 * Feature: npm-registry-switcher, Property 7: Protection comparison correctness
 *
 * **Validates: Requirements 5.1**
 *
 * For any two byte buffers A and B, the protection check SHALL report
 * isModified: true if and only if A and B are not byte-for-byte equal.
 * When no active profile is set or the npmrc file does not exist, the
 * protection check SHALL report isModified: false.
 */
describe('Property 7: Protection comparison correctness', () => {
  it('SHALL report isModified: true if and only if buffers A and B are not byte-for-byte equal', () => {
    fc.assert(
      fc.property(arbitraryBuffer, arbitraryBuffer, (bufA, bufB) => {
        const result = checkProtection(bufA, bufB);
        const areEqual = bufA.equals(bufB);

        if (areEqual) {
          expect(result.isModified).toBe(false);
        } else {
          expect(result.isModified).toBe(true);
        }
      }),
      { numRuns: 30 },
    );
  });

  it('SHALL report isModified: false when no active profile is set (activeProfileContent is null)', () => {
    fc.assert(
      fc.property(arbitraryBuffer, (npmrcContent) => {
        const result = checkProtection(npmrcContent, null);
        expect(result.isModified).toBe(false);
      }),
      { numRuns: 30 },
    );
  });

  it('SHALL report isModified: false when the npmrc file does not exist (npmrcContent is null)', () => {
    fc.assert(
      fc.property(arbitraryBuffer, (activeProfileContent) => {
        const result = checkProtection(null, activeProfileContent);
        expect(result.isModified).toBe(false);
      }),
      { numRuns: 30 },
    );
  });
});
