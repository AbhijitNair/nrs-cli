import readline from 'node:readline';
import { validateProfileName } from './utils.js';
import { NrsError, ErrorCodes } from './errors.js';

/**
 * Default prompt function using readline with [y/N] pattern.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
function defaultPrompt(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

/**
 * Checks if a destination profile exists and handles the overwrite confirmation.
 *
 * @param {object} store - ProfileStore instance
 * @param {string} destName - Destination profile name
 * @param {object} options - { promptFn, isInteractive }
 * @returns {Promise<void>} Resolves if operation should proceed, throws if aborted
 */
async function confirmOverwriteIfExists(store, destName, { promptFn = defaultPrompt, isInteractive = () => process.stdin.isTTY }) {
  const exists = await store.profileExists(destName);
  if (!exists) return;

  if (!isInteractive()) {
    throw new NrsError(
      `Profile '${destName}' already exists. Cannot overwrite in non-interactive mode.`,
      ErrorCodes.PROFILE_EXISTS,
      { profile: destName }
    );
  }

  const confirmed = await promptFn(`Profile '${destName}' already exists. Overwrite?`);
  if (!confirmed) {
    throw new NrsError(
      `Rename/copy aborted by user.`,
      ErrorCodes.SWITCH_ABORTED,
      { profile: destName }
    );
  }
}

/**
 * Executes the `nrs list` command.
 *
 * @param {object} store - ProfileStore instance
 * @returns {Promise<string>} Formatted output string
 */
export async function listCommand(store) {
  await store.ensureStoreExists();

  const profiles = await store.listProfiles();
  const activeProfile = await store.getActiveProfileName();

  if (profiles.length === 0) {
    return '';
  }

  const lines = profiles.map((name) => {
    if (name === activeProfile) {
      return `* ${name}`;
    }
    return `  ${name}`;
  });

  return lines.join('\n');
}

/**
 * Executes the `nrs list full` command.
 * Displays each profile name with its registry URL in brackets.
 *
 * @param {object} store - ProfileStore instance
 * @returns {Promise<string>} Formatted output string
 */
export async function listFullCommand(store) {
  await store.ensureStoreExists();

  const profiles = await store.listProfiles();
  const activeProfile = await store.getActiveProfileName();

  if (profiles.length === 0) {
    return '';
  }

  const lines = [];
  for (const name of profiles) {
    const content = await store.getProfile(name);
    const registry = extractRegistry(content);
    const prefix = name === activeProfile ? '* ' : '  ';
    if (registry) {
      lines.push(`${prefix}${name} [${registry}]`);
    } else {
      lines.push(`${prefix}${name}`);
    }
  }

  return lines.join('\n');
}

/**
 * Extracts the registry URL from profile content.
 *
 * @param {string|null} content
 * @returns {string|null}
 */
function extractRegistry(content) {
  if (!content) return null;
  const match = content.match(/^registry=(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Executes the `nrs use <profile_name>` command.
 *
 * @param {object} switcher - ProfileSwitcher instance
 * @param {string} profileName
 * @returns {Promise<{ message: string, warning?: string }>}
 */
export async function useCommand(switcher, profileName) {
  if (!profileName || profileName.trim() === '') {
    throw new NrsError(
      'Profile name is required',
      ErrorCodes.MISSING_ARGUMENT,
      { argument: 'profile_name' }
    );
  }

  const result = await switcher.switchTo(profileName);

  if (!result.success) {
    let code = ErrorCodes.PROFILE_NOT_FOUND;
    if (result.error && result.error.includes('Ambiguous')) {
      code = ErrorCodes.AMBIGUOUS_MATCH;
    } else if (result.error && result.error.includes('aborted')) {
      code = ErrorCodes.SWITCH_ABORTED;
    } else if (result.error && result.error.includes('externally modified')) {
      code = ErrorCodes.SWITCH_ABORTED;
    } else if (result.error && result.error.includes('cannot be written')) {
      code = ErrorCodes.FILE_WRITE_ERROR;
    }

    throw new NrsError(
      result.error || 'Failed to switch profile',
      code,
      { profile: profileName }
    );
  }

  const useResult = {
    message: `Switched to profile '${result.switched}'`,
  };

  if (result.warning) {
    useResult.warning = result.warning;
  }

  return useResult;
}

/**
 * Executes the `nrs <profile_name> set registry="<url>"` command.
 *
 * @param {object} store - ProfileStore instance
 * @param {{ profileName: string, registry: string }} args
 * @returns {Promise<string>} Confirmation message
 */
export async function setCommand(store, args) {
  const { profileName, registry } = args;

  if (!profileName) {
    throw new NrsError(
      'Profile name is required',
      ErrorCodes.MISSING_ARGUMENT,
      { argument: 'profileName' }
    );
  }

  const validation = validateProfileName(profileName);
  if (!validation.valid) {
    throw new NrsError(
      validation.error,
      ErrorCodes.INVALID_PROFILE_NAME,
      { profileName }
    );
  }

  if (!registry) {
    throw new NrsError(
      'Registry value is required',
      ErrorCodes.MISSING_ARGUMENT,
      { argument: 'registry' }
    );
  }

  await store.ensureStoreExists();

  const exists = await store.profileExists(profileName);
  const content = `registry=${registry}\n`;
  await store.writeProfile(profileName, content);

  if (exists) {
    return `Updated profile '${profileName}'`;
  }
  return `Created profile '${profileName}'`;
}

/**
 * Executes the `nrs delete <profile_name>` command.
 *
 * @param {object} store - ProfileStore instance
 * @param {string} profileName
 * @returns {Promise<{ message: string, warning?: string }>}
 */
export async function deleteCommand(store, profileName) {
  if (!profileName || profileName.trim() === '') {
    throw new NrsError(
      'Profile name is required',
      ErrorCodes.MISSING_ARGUMENT,
      { argument: 'profile_name' }
    );
  }

  await store.ensureStoreExists();

  const exists = await store.profileExists(profileName);
  if (!exists) {
    throw new NrsError(
      `Profile '${profileName}' not found`,
      ErrorCodes.PROFILE_NOT_FOUND,
      { profile: profileName }
    );
  }

  const activeProfile = await store.getActiveProfileName();
  const wasActive = activeProfile === profileName;

  const deleted = await store.deleteProfile(profileName);
  if (!deleted) {
    throw new NrsError(
      `Failed to delete profile '${profileName}'`,
      ErrorCodes.FILE_DELETE_ERROR,
      { profile: profileName }
    );
  }

  if (wasActive) {
    await store.setActiveProfileName(null);
    return {
      message: `Deleted profile '${profileName}'`,
      warning: `Profile '${profileName}' was the active profile. No profile is now active.`,
    };
  }

  return {
    message: `Deleted profile '${profileName}'`,
  };
}

/**
 * Executes the `nrs rename <oldName> <newName>` command.
 *
 * @param {object} store - ProfileStore instance
 * @param {string} oldName - Source profile name
 * @param {string} newName - Destination profile name
 * @param {object} [options] - { promptFn?, isInteractive? }
 * @returns {Promise<{ message: string }>}
 */
export async function renameCommand(store, oldName, newName, options = {}) {
  const { promptFn = defaultPrompt, isInteractive = () => process.stdin.isTTY } = options;

  if (!oldName || oldName.trim() === '') {
    throw new NrsError(
      'Profile name is required',
      ErrorCodes.MISSING_ARGUMENT,
      { argument: 'old' }
    );
  }

  if (!newName || newName.trim() === '') {
    throw new NrsError(
      'Profile name is required',
      ErrorCodes.MISSING_ARGUMENT,
      { argument: 'new' }
    );
  }

  const oldValidation = validateProfileName(oldName);
  if (!oldValidation.valid) {
    throw new NrsError(
      oldValidation.error,
      ErrorCodes.INVALID_PROFILE_NAME,
      { profileName: oldName }
    );
  }

  const newValidation = validateProfileName(newName);
  if (!newValidation.valid) {
    throw new NrsError(
      newValidation.error,
      ErrorCodes.INVALID_PROFILE_NAME,
      { profileName: newName }
    );
  }

  await store.ensureStoreExists();

  const sourceExists = await store.profileExists(oldName);
  if (!sourceExists) {
    throw new NrsError(
      `Profile '${oldName}' not found`,
      ErrorCodes.PROFILE_NOT_FOUND,
      { profile: oldName }
    );
  }

  await confirmOverwriteIfExists(store, newName, { promptFn, isInteractive });

  const content = await store.getProfile(oldName);
  await store.writeProfile(newName, content);
  await store.deleteProfile(oldName);

  const activeProfile = await store.getActiveProfileName();
  if (activeProfile === oldName) {
    await store.setActiveProfileName(newName);
  }

  return { message: `Renamed profile '${oldName}' to '${newName}'` };
}

/**
 * Executes the `nrs copy <source> <target>` command.
 *
 * @param {object} store - ProfileStore instance
 * @param {string} source - Source profile name
 * @param {string} target - Target profile name
 * @param {object} [options] - { promptFn?, isInteractive? }
 * @returns {Promise<{ message: string }>}
 */
export async function copyCommand(store, source, target, options = {}) {
  const { promptFn = defaultPrompt, isInteractive = () => process.stdin.isTTY } = options;

  if (!source || source.trim() === '') {
    throw new NrsError(
      'Profile name is required',
      ErrorCodes.MISSING_ARGUMENT,
      { argument: 'source' }
    );
  }

  if (!target || target.trim() === '') {
    throw new NrsError(
      'Profile name is required',
      ErrorCodes.MISSING_ARGUMENT,
      { argument: 'target' }
    );
  }

  const sourceValidation = validateProfileName(source);
  if (!sourceValidation.valid) {
    throw new NrsError(
      sourceValidation.error,
      ErrorCodes.INVALID_PROFILE_NAME,
      { profileName: source }
    );
  }

  const targetValidation = validateProfileName(target);
  if (!targetValidation.valid) {
    throw new NrsError(
      targetValidation.error,
      ErrorCodes.INVALID_PROFILE_NAME,
      { profileName: target }
    );
  }

  await store.ensureStoreExists();

  const sourceExists = await store.profileExists(source);
  if (!sourceExists) {
    throw new NrsError(
      `Profile '${source}' not found`,
      ErrorCodes.PROFILE_NOT_FOUND,
      { profile: source }
    );
  }

  await confirmOverwriteIfExists(store, target, { promptFn, isInteractive });

  const content = await store.getProfile(source);
  await store.writeProfile(target, content);

  return { message: `Copied profile '${source}' to '${target}'` };
}

/**
 * Executes the `nrs help` command.
 *
 * @returns {string} Formatted help string
 */
export function helpCommand() {
  const lines = [
    'nrs - NPM Registry Switcher',
    '',
    'Usage: nrs <command> [options]',
    '',
    'Commands:',
    '  list                            List all profiles (active profile marked with *)',
    '  list full                       List all profiles with registry URLs',
    '  use <profile>                   Switch to a profile',
    '  <profile> set registry="<url>"  Create or update a profile',
    '  delete <profile>                Delete a profile',
    '  rename <old> <new>              Rename a profile',
    '  copy <source> <target>          Copy a profile to a new name',
    '  help                            Show this help message',
    '',
    'Flags:',
    '  --version                       Show version number',
  ];

  return lines.join('\n');
}
