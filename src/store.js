import {
  readFile,
  readFileBuffer,
  writeFile,
  readdir,
  unlink,
  mkdir,
  access,
  joinPath,
} from './fs-adapter.js';
import { NrsError, ErrorCodes } from './errors.js';

const ACTIVE_FILE = '.active';

/**
 * Creates a ProfileStore backed by the file system.
 *
 * @param {{ storePath: string, npmrcPath: string }} config
 */
export function createProfileStore(config) {
  const { storePath, npmrcPath } = config;

  async function ensureStoreExists() {
    let isNew = false;
    try {
      await access(storePath);
    } catch {
      isNew = true;
    }

    if (isNew) {
      await mkdir(storePath, { recursive: true });

      try {
        await access(npmrcPath);
        const npmrcContent = await readFile(npmrcPath);
        const defaultProfilePath = joinPath(storePath, 'default');
        await writeFile(defaultProfilePath, npmrcContent);
      } catch {
        // .npmrc doesn't exist or can't be read — skip
      }
    }
  }

  async function listProfiles() {
    const entries = await readdir(storePath);
    return entries.filter((entry) => entry !== ACTIVE_FILE).sort();
  }

  async function getProfile(name) {
    const profilePath = joinPath(storePath, name);
    try {
      return await readFile(profilePath);
    } catch {
      return null;
    }
  }

  async function writeProfileFn(name, content) {
    const profilePath = joinPath(storePath, name);
    await writeFile(profilePath, content);
  }

  async function deleteProfile(name) {
    const profilePath = joinPath(storePath, name);
    try {
      await unlink(profilePath);
      return true;
    } catch {
      return false;
    }
  }

  async function profileExists(name) {
    const profilePath = joinPath(storePath, name);
    try {
      await access(profilePath);
      return true;
    } catch {
      return false;
    }
  }

  async function getActiveProfileName() {
    const activePath = joinPath(storePath, ACTIVE_FILE);
    try {
      const content = await readFile(activePath);
      const trimmed = content.trim();
      return trimmed || null;
    } catch {
      return null;
    }
  }

  async function setActiveProfileName(name) {
    const activePath = joinPath(storePath, ACTIVE_FILE);
    if (name === null) {
      try {
        await unlink(activePath);
      } catch {
        // File doesn't exist — that's fine
      }
    } else {
      await writeFile(activePath, name);
    }
  }

  return {
    ensureStoreExists,
    listProfiles,
    getProfile,
    writeProfile: writeProfileFn,
    deleteProfile,
    profileExists,
    getActiveProfileName,
    setActiveProfileName,
  };
}

/**
 * Manages reading and writing the user's .npmrc file.
 */
export class NpmrcManager {
  constructor(npmrcPath) {
    this.npmrcPath = npmrcPath;
  }

  /**
   * Reads the .npmrc file as a Buffer.
   * Returns null if the file does not exist.
   */
  async read() {
    try {
      return await readFileBuffer(this.npmrcPath);
    } catch (err) {
      if (err instanceof NrsError && err.code === ErrorCodes.FILE_READ_ERROR) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Writes string content to the .npmrc file.
   */
  async write(content) {
    await writeFile(this.npmrcPath, content);
  }

  /**
   * Checks if the .npmrc file exists.
   */
  async exists() {
    try {
      await access(this.npmrcPath);
      return true;
    } catch {
      return false;
    }
  }
}
