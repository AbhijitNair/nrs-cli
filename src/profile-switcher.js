import readline from 'node:readline';
import { matchProfile, checkProtection } from './utils.js';

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
 * Creates a ProfileSwitcher that orchestrates profile switching.
 *
 * @param {{ profileStore, npmrcManager, promptFn?, isInteractive? }} deps
 */
export function createProfileSwitcher(deps) {
  const {
    profileStore,
    npmrcManager,
    promptFn = defaultPrompt,
    isInteractive = () => !!process.stdin.isTTY,
  } = deps;

  async function switchTo(profileName, options) {
    const profiles = await profileStore.listProfiles();
    const match = matchProfile(profileName, profiles);

    if (match.type === 'none') {
      return {
        success: false,
        error: `Profile "${profileName}" not found. Available profiles: ${profiles.join(', ')}`,
      };
    }

    if (match.type === 'ambiguous') {
      return {
        success: false,
        error: `Ambiguous profile name "${profileName}". Matches: ${match.matches.join(', ')}`,
      };
    }

    const resolvedName = match.matches[0];

    const profileContent = await profileStore.getProfile(resolvedName);
    if (profileContent === null) {
      return {
        success: false,
        error: `Profile "${resolvedName}" could not be read.`,
      };
    }

    if (!options?.force) {
      const npmrcContent = await npmrcManager.read();
      const activeProfileName = await profileStore.getActiveProfileName();

      let activeProfileContent = null;
      if (activeProfileName !== null) {
        const activeContent = await profileStore.getProfile(activeProfileName);
        activeProfileContent = activeContent !== null ? Buffer.from(activeContent) : null;
      }

      const protection = checkProtection(npmrcContent, activeProfileContent);

      if (protection.isModified) {
        if (!isInteractive()) {
          return {
            success: false,
            error: 'Npmrc file has been externally modified. Cannot switch in non-interactive mode. Use --force to override.',
          };
        }

        const confirmed = await promptFn(
          'Your .npmrc has been modified externally. Overwrite with profile content?'
        );

        if (!confirmed) {
          return {
            success: false,
            error: 'Switch aborted by user.',
          };
        }
      }
    }

    await npmrcManager.write(profileContent);
    await profileStore.setActiveProfileName(resolvedName);

    const result = { success: true, switched: resolvedName };

    if (match.type === 'prefix') {
      result.warning = `Matched prefix "${profileName}" to profile "${resolvedName}".`;
    }

    return result;
  }

  return { switchTo };
}
