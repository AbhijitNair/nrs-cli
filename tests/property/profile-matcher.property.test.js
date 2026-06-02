import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { matchProfile } from '../../src/utils.js';
import { validProfileName } from '../helpers/generators.js';

/**
 * Property 2: Profile matching precedence
 *
 * For any set of profile names and any input string, the profile matcher SHALL return:
 * (a) an exact match if the input equals a profile name, regardless of whether it is also a prefix of other names;
 * (b) a unique prefix match if exactly one profile starts with the input and no exact match exists;
 * (c) an ambiguous result listing all prefix-matching profiles if multiple profiles start with the input and no exact match exists;
 * (d) no match if no profile name starts with or equals the input.
 *
 * Validates: Requirements 2.2, 2.3, 2.4
 */
describe('Feature: npm-registry-switcher, Property 2: Profile matching precedence', () => {
  it('(a) exact match takes precedence even when input is also a prefix of other names', () => {
    fc.assert(
      fc.property(
        validProfileName,
        fc.array(validProfileName, { minLength: 0, maxLength: 10 }),
        (exactName, otherProfiles) => {
          // Build a profile list that includes the exact name plus others that start with it
          const extendedProfiles = otherProfiles
            .filter((p) => p !== exactName)
            .map((p) => exactName + p);
          const profiles = [exactName, ...extendedProfiles];

          const result = matchProfile(exactName, profiles);

          expect(result.type).toBe('exact');
          expect(result.matches).toEqual([exactName]);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('(b) unique prefix match if exactly one profile starts with the input and no exact match exists', () => {
    fc.assert(
      fc.property(
        validProfileName,
        validProfileName.filter((s) => s.length >= 1),
        fc.array(validProfileName, { minLength: 0, maxLength: 10 }),
        (prefix, suffix, otherProfiles) => {
          // Ensure suffix is non-empty so the full name differs from the prefix
          const fullName = prefix + suffix;
          if (fullName === prefix) return; // skip degenerate case (exact match)

          // Filter other profiles so none starts with the prefix and none equals the prefix
          const filteredOthers = otherProfiles.filter(
            (p) => p !== prefix && p !== fullName && !p.startsWith(prefix),
          );

          const profiles = [fullName, ...filteredOthers];

          const result = matchProfile(prefix, profiles);

          expect(result.type).toBe('prefix');
          expect(result.matches).toEqual([fullName]);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('(c) ambiguous result listing all prefix-matching profiles if multiple profiles start with the input and no exact match exists', () => {
    fc.assert(
      fc.property(
        validProfileName,
        validProfileName.filter((s) => s.length >= 1),
        validProfileName.filter((s) => s.length >= 1),
        fc.array(validProfileName, { minLength: 0, maxLength: 10 }),
        (prefix, suffix1, suffix2, otherProfiles) => {
          const name1 = prefix + suffix1;
          const name2 = prefix + suffix2;

          // Ensure both names differ from the prefix (no exact match) and from each other
          if (name1 === prefix || name2 === prefix || name1 === name2) return;

          // Filter other profiles so none equals the prefix
          const filteredOthers = otherProfiles.filter(
            (p) => p !== prefix && p !== name1 && p !== name2 && !p.startsWith(prefix),
          );

          const profiles = [name1, name2, ...filteredOthers];

          const result = matchProfile(prefix, profiles);

          expect(result.type).toBe('ambiguous');
          // All prefix-matching profiles should be in the matches
          expect(result.matches).toContain(name1);
          expect(result.matches).toContain(name2);
          // Every match should start with the prefix
          for (const match of result.matches) {
            expect(match.startsWith(prefix)).toBe(true);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('(d) no match if no profile name starts with or equals the input', () => {
    fc.assert(
      fc.property(
        validProfileName,
        fc.array(validProfileName, { minLength: 0, maxLength: 10 }),
        (input, profiles) => {
          // Filter profiles so none starts with or equals the input
          const filteredProfiles = profiles.filter(
            (p) => p !== input && !p.startsWith(input),
          );

          const result = matchProfile(input, filteredProfiles);

          expect(result.type).toBe('none');
          expect(result.matches).toEqual([]);
        },
      ),
      { numRuns: 30 },
    );
  });
});
