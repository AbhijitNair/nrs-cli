import { describe, it, expect } from 'vitest';
import { validateProfileName } from '../../src/utils.js';

describe('validateProfileName', () => {
  describe('valid names', () => {
    it('accepts a simple alphabetic name', () => {
      expect(validateProfileName('work')).toEqual({ valid: true });
    });

    it('accepts a name with hyphens', () => {
      expect(validateProfileName('my-registry')).toEqual({ valid: true });
    });

    it('accepts a name with underscores', () => {
      expect(validateProfileName('my_registry')).toEqual({ valid: true });
    });

    it('accepts a name with digits', () => {
      expect(validateProfileName('registry123')).toEqual({ valid: true });
    });

    it('accepts a single character name', () => {
      expect(validateProfileName('a')).toEqual({ valid: true });
    });

    it('accepts a name at the maximum length of 64 characters', () => {
      const name = 'a'.repeat(64);
      expect(validateProfileName(name)).toEqual({ valid: true });
    });

    it('accepts a name with mixed valid characters', () => {
      expect(validateProfileName('My_Profile-01')).toEqual({ valid: true });
    });
  });

  describe('invalid names', () => {
    it('rejects an empty string', () => {
      const result = validateProfileName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Profile name must not be empty');
    });

    it('rejects a name exceeding 64 characters', () => {
      const name = 'a'.repeat(65);
      const result = validateProfileName(name);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must not exceed 64 characters');
      expect(result.error).toContain('got 65');
    });

    it('rejects a name with spaces', () => {
      const result = validateProfileName('my registry');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('alphanumeric characters, hyphens, or underscores');
    });

    it('rejects a name with dots', () => {
      const result = validateProfileName('my.registry');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('alphanumeric characters, hyphens, or underscores');
    });

    it('rejects a name with special characters', () => {
      const result = validateProfileName('my@registry!');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('alphanumeric characters, hyphens, or underscores');
    });

    it('rejects a name with slashes', () => {
      const result = validateProfileName('path/name');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('alphanumeric characters, hyphens, or underscores');
    });
  });
});
