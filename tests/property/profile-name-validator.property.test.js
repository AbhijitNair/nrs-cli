import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateProfileName } from '../../src/utils.js';
import { validProfileName, invalidProfileName } from '../helpers/generators.js';

/**
 * Feature: npm-registry-switcher, Property 4: Profile name validation
 *
 * **Validates: Requirements 3.3**
 *
 * For any string that contains characters outside [a-zA-Z0-9_-] or has length
 * outside 1-64, the validator SHALL reject it. For any string composed only of
 * characters in [a-zA-Z0-9_-] with length 1-64, the validator SHALL accept it.
 */
describe('Property 4: Profile name validation', () => {
  it('SHALL accept any string composed only of [a-zA-Z0-9_-] with length 1-64', () => {
    fc.assert(
      fc.property(validProfileName, (name) => {
        const result = validateProfileName(name);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 30 },
    );
  });

  it('SHALL reject any string with invalid characters or length outside 1-64', () => {
    fc.assert(
      fc.property(invalidProfileName, (name) => {
        const result = validateProfileName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }),
      { numRuns: 30 },
    );
  });
});
