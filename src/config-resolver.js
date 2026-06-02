import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { NrsError, ErrorCodes } from './errors.js';

/**
 * Resolves NRS configuration by checking environment variables with fallback to defaults.
 *
 * @returns {{ storePath: string, npmrcPath: string }}
 */
export function resolveConfig() {
  const nrsStore = process.env.NRS_STORE?.trim() || '';
  const nrsNpmrc = process.env.NRS_NPMRC?.trim() || '';

  let homeDir;
  try {
    homeDir = os.homedir();
    if (!homeDir) {
      throw new Error('Empty home directory');
    }
  } catch {
    throw new NrsError(
      'Cannot resolve home directory. Set NRS_STORE and NRS_NPMRC environment variables to specify paths explicitly.',
      ErrorCodes.HOME_DIR_ERROR
    );
  }

  let storePath;
  if (nrsStore) {
    storePath = path.resolve(nrsStore);
    validateEnvPath(storePath, 'NRS_STORE');
  } else {
    storePath = path.join(homeDir, '.nrs');
  }

  let npmrcPath;
  if (nrsNpmrc) {
    npmrcPath = path.resolve(nrsNpmrc);
    validateEnvPath(npmrcPath, 'NRS_NPMRC');
  } else {
    npmrcPath = path.join(homeDir, '.npmrc');
  }

  return { storePath, npmrcPath };
}

function validateEnvPath(resolvedPath, envVarName) {
  const parentDir = path.dirname(resolvedPath);
  try {
    fs.accessSync(parentDir, fs.constants.R_OK);
  } catch {
    throw new NrsError(
      `Path specified by ${envVarName} is not accessible: ${resolvedPath}`,
      ErrorCodes.INVALID_PATH,
      { envVar: envVarName, path: resolvedPath }
    );
  }
}
