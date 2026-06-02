import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Creates a temporary directory for test isolation.
 * Returns the path to the created directory.
 */
export async function createTempDir(prefix = 'nrs-test-') {
  return mkdtemp(join(tmpdir(), prefix));
}

/**
 * Removes a temporary directory and all its contents recursively.
 */
export async function cleanupTempDir(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
}
