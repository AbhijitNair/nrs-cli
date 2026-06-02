import fc from 'fast-check';

/**
 * Characters allowed in valid profile names: [a-zA-Z0-9_-]
 */
const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';

/**
 * Generates valid profile names matching /^[a-zA-Z0-9_-]+$/ with length 1-64.
 */
export const validProfileName = fc.string({
  unit: fc.constantFrom(...VALID_CHARS.split('')),
  minLength: 1,
  maxLength: 64,
});

/**
 * Generates invalid profile names that violate the profile name rules.
 * Covers: empty strings, strings longer than 64 chars, strings with invalid characters.
 */
export const invalidProfileName = fc.oneof(
  // Empty string
  fc.constant(''),
  // Too long (65-128 chars of valid characters)
  fc.string({
    unit: fc.constantFrom(...VALID_CHARS.split('')),
    minLength: 65,
    maxLength: 128,
  }),
  // Contains invalid characters (at least one char outside the valid set)
  fc
    .tuple(
      fc.string({
        unit: fc.constantFrom(...VALID_CHARS.split('')),
        minLength: 0,
        maxLength: 30,
      }),
      fc.string({ minLength: 1, maxLength: 1 }).filter((c) => !VALID_CHARS.includes(c)),
      fc.string({
        unit: fc.constantFrom(...VALID_CHARS.split('')),
        minLength: 0,
        maxLength: 30,
      }),
    )
    .map(([before, invalid, after]) => `${before}${invalid}${after}`),
);

/**
 * Generates valid registry URL strings (https URLs ending with /).
 */
export const registryUrl = fc
  .tuple(
    fc.constantFrom('https://'),
    fc.string({
      unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      minLength: 1,
      maxLength: 20,
    }),
    fc.constantFrom('.npmjs.org/', '.example.com/', '.registry.io/', '.mycompany.net/'),
  )
  .map(([protocol, subdomain, domain]) => `${protocol}${subdomain}${domain}`);

/**
 * Generates valid .npmrc-style profile content (registry=<url> lines).
 */
export const profileContent = registryUrl.map(
  (url) => `registry=${url}\n`,
);

/**
 * Generates arbitrary byte buffers for protection comparison tests.
 */
export const arbitraryBuffer = fc
  .uint8Array({ minLength: 0, maxLength: 512 })
  .map((arr) => Buffer.from(arr));
