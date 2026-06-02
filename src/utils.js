/**
 * Match an input string against a list of profile names.
 *
 * Algorithm:
 * 1. Exact match (case-sensitive) → { type: 'exact', matches: [name] }
 * 2. Find all profiles where profile.startsWith(input)
 * 3. Exactly one prefix match → { type: 'prefix', matches: [name] }
 * 4. Multiple prefix matches → { type: 'ambiguous', matches: [...names] }
 * 5. No matches → { type: 'none', matches: [] }
 *
 * @param {string} input
 * @param {string[]} profiles
 * @returns {{ type: 'exact'|'prefix'|'ambiguous'|'none', matches: string[] }}
 */
export function matchProfile(input, profiles) {
  if (profiles.includes(input)) {
    return { type: 'exact', matches: [input] };
  }

  const prefixMatches = profiles.filter((profile) => profile.startsWith(input));

  if (prefixMatches.length === 1) {
    return { type: 'prefix', matches: [prefixMatches[0]] };
  }

  if (prefixMatches.length > 1) {
    return { type: 'ambiguous', matches: prefixMatches };
  }

  return { type: 'none', matches: [] };
}

const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_LENGTH = 64;

/**
 * Validates a profile name.
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProfileName(name) {
  if (name.length === 0) {
    return { valid: false, error: 'Profile name must not be empty' };
  }

  if (name.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Profile name must not exceed ${MAX_LENGTH} characters (got ${name.length})`,
    };
  }

  if (!PROFILE_NAME_PATTERN.test(name)) {
    return {
      valid: false,
      error: 'Profile name must contain only alphanumeric characters, hyphens, or underscores',
    };
  }

  return { valid: true };
}

/**
 * Compare npmrc content against active profile content using Buffer.equals().
 *
 * Returns isModified: false when:
 * - activeProfileContent is null (no active profile set)
 * - npmrcContent is null (npmrc doesn't exist)
 * - Contents match exactly (byte-for-byte equal)
 *
 * @param {Buffer|null} npmrcContent
 * @param {Buffer|null} activeProfileContent
 * @returns {{ isModified: boolean, activeProfile: string|null }}
 */
export function checkProtection(npmrcContent, activeProfileContent) {
  if (activeProfileContent === null) {
    return { isModified: false, activeProfile: null };
  }

  if (npmrcContent === null) {
    return { isModified: false, activeProfile: null };
  }

  if (npmrcContent.equals(activeProfileContent)) {
    return { isModified: false, activeProfile: null };
  }

  return { isModified: true, activeProfile: null };
}
