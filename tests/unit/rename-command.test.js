import { describe, it, expect, vi } from 'vitest';
import { renameCommand } from '../../src/commands.js';
import { NrsError, ErrorCodes } from '../../src/errors.js';

describe('renameCommand', () => {
  function createMockStore({ profiles = {}, activeProfile = null } = {}) {
    const store = {
      ensureStoreExists: vi.fn().mockResolvedValue(undefined),
      profileExists: vi.fn().mockImplementation(async (name) => name in profiles),
      getProfile: vi.fn().mockImplementation(async (name) => profiles[name] || null),
      writeProfile: vi.fn().mockResolvedValue(undefined),
      deleteProfile: vi.fn().mockResolvedValue(true),
      getActiveProfileName: vi.fn().mockResolvedValue(activeProfile),
      setActiveProfileName: vi.fn().mockResolvedValue(undefined),
      listProfiles: vi.fn().mockResolvedValue(Object.keys(profiles)),
    };
    return store;
  }

  it('renames a profile preserving content and removing old', async () => {
    const store = createMockStore({
      profiles: { work: 'registry=https://work.example.com/\n' },
      activeProfile: null,
    });

    const result = await renameCommand(store, 'work', 'office');

    expect(result.message).toBe("Renamed profile 'work' to 'office'");
    expect(store.getProfile).toHaveBeenCalledWith('work');
    expect(store.writeProfile).toHaveBeenCalledWith('office', 'registry=https://work.example.com/\n');
    expect(store.deleteProfile).toHaveBeenCalledWith('work');
  });

  it('updates active marker when source was active', async () => {
    const store = createMockStore({
      profiles: { work: 'registry=https://work.example.com/\n' },
      activeProfile: 'work',
    });

    await renameCommand(store, 'work', 'office');

    expect(store.setActiveProfileName).toHaveBeenCalledWith('office');
  });

  it('leaves active marker unchanged when source was not active', async () => {
    const store = createMockStore({
      profiles: { work: 'registry=https://work.example.com/\n' },
      activeProfile: 'personal',
    });

    await renameCommand(store, 'work', 'office');

    expect(store.setActiveProfileName).not.toHaveBeenCalled();
  });

  it('throws MISSING_ARGUMENT for empty old name', async () => {
    const store = createMockStore();

    try {
      await renameCommand(store, '', 'newname');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws MISSING_ARGUMENT for whitespace-only old name', async () => {
    const store = createMockStore();

    try {
      await renameCommand(store, '   ', 'newname');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws MISSING_ARGUMENT for empty new name', async () => {
    const store = createMockStore();

    try {
      await renameCommand(store, 'oldname', '');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws MISSING_ARGUMENT for whitespace-only new name', async () => {
    const store = createMockStore();

    try {
      await renameCommand(store, 'oldname', '   ');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.MISSING_ARGUMENT);
    }
  });

  it('throws INVALID_PROFILE_NAME for invalid old name', async () => {
    const store = createMockStore();

    try {
      await renameCommand(store, 'invalid name!', 'newname');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.INVALID_PROFILE_NAME);
    }
  });

  it('throws INVALID_PROFILE_NAME for invalid new name', async () => {
    const store = createMockStore({
      profiles: { work: 'registry=https://work.example.com/\n' },
    });

    try {
      await renameCommand(store, 'work', 'invalid name!');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.INVALID_PROFILE_NAME);
    }
  });

  it('throws PROFILE_NOT_FOUND for non-existent source', async () => {
    const store = createMockStore({ profiles: {} });

    try {
      await renameCommand(store, 'nonexistent', 'newname');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_NOT_FOUND);
      expect(err.message).toContain('nonexistent');
    }
  });

  it('throws PROFILE_EXISTS when destination exists in non-interactive mode', async () => {
    const store = createMockStore({
      profiles: {
        work: 'registry=https://work.example.com/\n',
        office: 'registry=https://office.example.com/\n',
      },
    });

    const options = {
      promptFn: vi.fn(),
      isInteractive: () => false,
    };

    try {
      await renameCommand(store, 'work', 'office', options);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.PROFILE_EXISTS);
      expect(options.promptFn).not.toHaveBeenCalled();
    }
  });

  it('proceeds when user confirms overwrite', async () => {
    const store = createMockStore({
      profiles: {
        work: 'registry=https://work.example.com/\n',
        office: 'registry=https://office.example.com/\n',
      },
      activeProfile: null,
    });

    const options = {
      promptFn: vi.fn().mockResolvedValue(true),
      isInteractive: () => true,
    };

    const result = await renameCommand(store, 'work', 'office', options);

    expect(result.message).toBe("Renamed profile 'work' to 'office'");
    expect(options.promptFn).toHaveBeenCalled();
    expect(store.writeProfile).toHaveBeenCalledWith('office', 'registry=https://work.example.com/\n');
    expect(store.deleteProfile).toHaveBeenCalledWith('work');
  });

  it('aborts when user declines overwrite', async () => {
    const store = createMockStore({
      profiles: {
        work: 'registry=https://work.example.com/\n',
        office: 'registry=https://office.example.com/\n',
      },
    });

    const options = {
      promptFn: vi.fn().mockResolvedValue(false),
      isInteractive: () => true,
    };

    try {
      await renameCommand(store, 'work', 'office', options);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NrsError);
      expect(err.code).toBe(ErrorCodes.SWITCH_ABORTED);
      expect(store.writeProfile).not.toHaveBeenCalled();
      expect(store.deleteProfile).not.toHaveBeenCalled();
    }
  });
});
