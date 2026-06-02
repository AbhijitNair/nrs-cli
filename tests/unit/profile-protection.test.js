import { describe, it, expect } from 'vitest';
import { checkProtection } from '../../src/utils.js';

describe('checkProtection', () => {
  it('returns isModified: false when activeProfileContent is null', () => {
    const npmrc = Buffer.from('registry=https://registry.npmjs.org/');
    const result = checkProtection(npmrc, null);
    expect(result).toEqual({ isModified: false, activeProfile: null });
  });

  it('returns isModified: false when npmrcContent is null', () => {
    const profile = Buffer.from('registry=https://registry.npmjs.org/');
    const result = checkProtection(null, profile);
    expect(result).toEqual({ isModified: false, activeProfile: null });
  });

  it('returns isModified: false when both are null', () => {
    const result = checkProtection(null, null);
    expect(result).toEqual({ isModified: false, activeProfile: null });
  });

  it('returns isModified: false when contents match exactly', () => {
    const content = 'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=abc123';
    const npmrc = Buffer.from(content);
    const profile = Buffer.from(content);
    const result = checkProtection(npmrc, profile);
    expect(result).toEqual({ isModified: false, activeProfile: null });
  });

  it('returns isModified: true when contents differ', () => {
    const npmrc = Buffer.from('registry=https://custom.registry.io/');
    const profile = Buffer.from('registry=https://registry.npmjs.org/');
    const result = checkProtection(npmrc, profile);
    expect(result).toEqual({ isModified: true, activeProfile: null });
  });

  it('returns isModified: true when contents differ by a single byte', () => {
    const npmrc = Buffer.from('registry=https://registry.npmjs.org/\n');
    const profile = Buffer.from('registry=https://registry.npmjs.org/');
    const result = checkProtection(npmrc, profile);
    expect(result).toEqual({ isModified: true, activeProfile: null });
  });

  it('returns isModified: false for empty buffers', () => {
    const npmrc = Buffer.alloc(0);
    const profile = Buffer.alloc(0);
    const result = checkProtection(npmrc, profile);
    expect(result).toEqual({ isModified: false, activeProfile: null });
  });

  it('returns isModified: true when one buffer is empty and the other is not', () => {
    const npmrc = Buffer.alloc(0);
    const profile = Buffer.from('registry=https://registry.npmjs.org/');
    const result = checkProtection(npmrc, profile);
    expect(result).toEqual({ isModified: true, activeProfile: null });
  });

  it('always returns activeProfile as null', () => {
    const npmrc = Buffer.from('content');
    const profile = Buffer.from('different');
    const result = checkProtection(npmrc, profile);
    expect(result.activeProfile).toBeNull();
  });
});
