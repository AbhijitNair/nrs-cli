import { describe, it, expect } from 'vitest';
import { matchProfile } from '../../src/utils.js';

describe('matchProfile', () => {
  const profiles = ['default', 'dev', 'production', 'private-registry'];

  describe('exact match', () => {
    it('returns exact match when input equals a profile name', () => {
      const result = matchProfile('default', profiles);
      expect(result).toEqual({ type: 'exact', matches: ['default'] });
    });

    it('returns exact match even when input is also a prefix of other profiles', () => {
      const result = matchProfile('dev', profiles);
      expect(result).toEqual({ type: 'exact', matches: ['dev'] });
    });

    it('is case-sensitive for exact matching', () => {
      const result = matchProfile('Default', profiles);
      // 'Default' does not exactly match 'default', and no prefix matches
      expect(result.type).not.toBe('exact');
    });
  });

  describe('prefix match', () => {
    it('returns prefix match when exactly one profile starts with input', () => {
      const result = matchProfile('prod', profiles);
      expect(result).toEqual({ type: 'prefix', matches: ['production'] });
    });

    it('returns prefix match for single character prefix with one match', () => {
      const result = matchProfile('pr', ['default', 'production', 'staging']);
      expect(result).toEqual({ type: 'prefix', matches: ['production'] });
    });
  });

  describe('ambiguous match', () => {
    it('returns ambiguous when multiple profiles match the prefix', () => {
      const result = matchProfile('pr', profiles);
      expect(result).toEqual({
        type: 'ambiguous',
        matches: ['production', 'private-registry'],
      });
    });

    it('returns ambiguous with all matching profiles listed', () => {
      const result = matchProfile('d', profiles);
      expect(result).toEqual({
        type: 'ambiguous',
        matches: ['default', 'dev'],
      });
    });
  });

  describe('no match', () => {
    it('returns none when no profile matches', () => {
      const result = matchProfile('staging', profiles);
      expect(result).toEqual({ type: 'none', matches: [] });
    });

    it('returns none for empty input with empty profiles list', () => {
      const result = matchProfile('anything', []);
      expect(result).toEqual({ type: 'none', matches: [] });
    });

    it('returns none when input differs by case', () => {
      const result = matchProfile('Production', profiles);
      expect(result).toEqual({ type: 'none', matches: [] });
    });
  });

  describe('case sensitivity', () => {
    it('does not match case-insensitively', () => {
      const result = matchProfile('DEV', profiles);
      expect(result).toEqual({ type: 'none', matches: [] });
    });

    it('matches case-sensitive prefix correctly', () => {
      const mixedProfiles = ['Dev', 'dev', 'Development'];
      const result = matchProfile('Dev', mixedProfiles);
      expect(result).toEqual({ type: 'exact', matches: ['Dev'] });
    });
  });

  describe('edge cases', () => {
    it('handles empty input matching all profiles as ambiguous', () => {
      const result = matchProfile('', ['a', 'b', 'c']);
      // Empty string is a prefix of everything
      expect(result).toEqual({ type: 'ambiguous', matches: ['a', 'b', 'c'] });
    });

    it('handles empty input with single profile as prefix match', () => {
      const result = matchProfile('', ['only']);
      expect(result).toEqual({ type: 'prefix', matches: ['only'] });
    });

    it('handles input longer than any profile name', () => {
      const result = matchProfile('default-extra', profiles);
      expect(result).toEqual({ type: 'none', matches: [] });
    });
  });
});
