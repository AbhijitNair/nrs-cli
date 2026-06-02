import { describe, it, expect, beforeEach } from 'vitest';
import { createProfileSwitcher } from '../../src/profile-switcher.js';

/**
 * Creates a mock ProfileStore with configurable behavior.
 */
function createMockProfileStore(options = {}) {
  const {
    profiles = [],
    profileContents = {},
    activeProfile = null,
  } = options;

  let currentActive = activeProfile;

  return {
    ensureStoreExists: async () => {},
    listProfiles: async () => [...profiles].sort(),
    getProfile: async (name) => profileContents[name] ?? null,
    writeProfile: async () => {},
    deleteProfile: async () => true,
    profileExists: async (name) => profiles.includes(name),
    getActiveProfileName: async () => currentActive,
    setActiveProfileName: async (name) => {
      currentActive = name;
    },
  };
}

/**
 * Creates a mock NpmrcManager with configurable behavior.
 */
function createMockNpmrcManager(options = {}) {
  const { content = null } = options;
  const written = [];

  return {
    read: async () => content,
    write: async (c) => { written.push(c); },
    exists: async () => content !== null,
    written,
  };
}

describe('ProfileSwitcher', () => {
  describe('switchTo - match resolution', () => {
    it('should return error when no profiles match', async () => {
      const store = createMockProfileStore({
        profiles: ['work', 'personal', 'oss'],
        profileContents: { work: 'reg=a', personal: 'reg=b', oss: 'reg=c' },
      });
      const npmrc = createMockNpmrcManager();
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => true,
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.error).toContain('work');
      expect(result.error).toContain('personal');
      expect(result.error).toContain('oss');
    });

    it('should return error when match is ambiguous', async () => {
      const store = createMockProfileStore({
        profiles: ['work-internal', 'work-external'],
        profileContents: { 'work-internal': 'reg=a', 'work-external': 'reg=b' },
      });
      const npmrc = createMockNpmrcManager();
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => true,
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('work');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ambiguous');
      expect(result.error).toContain('work-internal');
      expect(result.error).toContain('work-external');
    });

    it('should switch on exact match', async () => {
      const store = createMockProfileStore({
        profiles: ['work', 'work-extra'],
        profileContents: { work: 'registry=https://work.example.com', 'work-extra': 'reg=b' },
      });
      const npmrc = createMockNpmrcManager();
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => true,
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('work');

      expect(result.success).toBe(true);
      expect(result.switched).toBe('work');
      expect(npmrc.written[0]).toBe('registry=https://work.example.com');
    });

    it('should switch on prefix match with warning', async () => {
      const store = createMockProfileStore({
        profiles: ['personal', 'work'],
        profileContents: { personal: 'registry=https://personal.example.com', work: 'reg=b' },
      });
      const npmrc = createMockNpmrcManager();
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => true,
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('per');

      expect(result.success).toBe(true);
      expect(result.switched).toBe('personal');
      expect(result.warning).toContain('prefix');
      expect(result.warning).toContain('personal');
    });
  });

  describe('switchTo - protection checks', () => {
    it('should proceed without prompt when npmrc matches active profile', async () => {
      const profileContent = 'registry=https://work.example.com';
      const store = createMockProfileStore({
        profiles: ['work', 'personal'],
        profileContents: { work: profileContent, personal: 'registry=https://personal.example.com' },
        activeProfile: 'work',
      });
      const npmrc = createMockNpmrcManager({
        content: Buffer.from(profileContent),
      });
      let prompted = false;
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => { prompted = true; return true; },
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('personal');

      expect(result.success).toBe(true);
      expect(prompted).toBe(false);
    });

    it('should prompt when npmrc is externally modified in interactive mode', async () => {
      const store = createMockProfileStore({
        profiles: ['work', 'personal'],
        profileContents: { work: 'registry=https://work.example.com', personal: 'registry=https://personal.example.com' },
        activeProfile: 'work',
      });
      const npmrc = createMockNpmrcManager({
        content: Buffer.from('registry=https://modified.example.com'),
      });
      let prompted = false;
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => { prompted = true; return true; },
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('personal');

      expect(result.success).toBe(true);
      expect(prompted).toBe(true);
    });

    it('should abort when user declines prompt', async () => {
      const store = createMockProfileStore({
        profiles: ['work', 'personal'],
        profileContents: { work: 'registry=https://work.example.com', personal: 'registry=https://personal.example.com' },
        activeProfile: 'work',
      });
      const npmrc = createMockNpmrcManager({
        content: Buffer.from('registry=https://modified.example.com'),
      });
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => false,
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('personal');

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
      expect(npmrc.written.length).toBe(0);
    });

    it('should abort in non-interactive mode when npmrc is modified', async () => {
      const store = createMockProfileStore({
        profiles: ['work', 'personal'],
        profileContents: { work: 'registry=https://work.example.com', personal: 'registry=https://personal.example.com' },
        activeProfile: 'work',
      });
      const npmrc = createMockNpmrcManager({
        content: Buffer.from('registry=https://modified.example.com'),
      });
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => true,
        isInteractive: () => false,
      });

      const result = await switcher.switchTo('personal');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non-interactive');
      expect(npmrc.written.length).toBe(0);
    });

    it('should skip protection check when force option is set', async () => {
      const store = createMockProfileStore({
        profiles: ['work', 'personal'],
        profileContents: { work: 'registry=https://work.example.com', personal: 'registry=https://personal.example.com' },
        activeProfile: 'work',
      });
      const npmrc = createMockNpmrcManager({
        content: Buffer.from('registry=https://modified.example.com'),
      });
      let prompted = false;
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => { prompted = true; return false; },
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('personal', { force: true });

      expect(result.success).toBe(true);
      expect(result.switched).toBe('personal');
      expect(prompted).toBe(false);
    });
  });

  describe('switchTo - state updates', () => {
    it('should write profile content to npmrc and update active state', async () => {
      const store = createMockProfileStore({
        profiles: ['work'],
        profileContents: { work: 'registry=https://work.example.com\n//work.example.com/:_authToken=token123' },
      });
      const npmrc = createMockNpmrcManager();
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => true,
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('work');

      expect(result.success).toBe(true);
      expect(result.switched).toBe('work');
      expect(npmrc.written[0]).toBe('registry=https://work.example.com\n//work.example.com/:_authToken=token123');
      expect(await store.getActiveProfileName()).toBe('work');
    });

    it('should proceed when no active profile is set (no protection needed)', async () => {
      const store = createMockProfileStore({
        profiles: ['work'],
        profileContents: { work: 'registry=https://work.example.com' },
        activeProfile: null,
      });
      const npmrc = createMockNpmrcManager({
        content: Buffer.from('some existing content'),
      });
      let prompted = false;
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => { prompted = true; return true; },
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('work');

      expect(result.success).toBe(true);
      expect(prompted).toBe(false);
    });

    it('should proceed when npmrc does not exist', async () => {
      const store = createMockProfileStore({
        profiles: ['work'],
        profileContents: { work: 'registry=https://work.example.com' },
        activeProfile: 'old-profile',
      });
      const npmrc = createMockNpmrcManager({ content: null });
      let prompted = false;
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager: npmrc,
        promptFn: async () => { prompted = true; return true; },
        isInteractive: () => true,
      });

      const result = await switcher.switchTo('work');

      expect(result.success).toBe(true);
      expect(prompted).toBe(false);
    });
  });
});
