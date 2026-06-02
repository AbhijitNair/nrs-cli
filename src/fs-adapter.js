import fs from 'node:fs';
import path from 'node:path';
import { NrsError, ErrorCodes } from './errors.js';

function getErrorCode(systemCode, operation) {
  if (systemCode === 'EACCES' || systemCode === 'EPERM') {
    return ErrorCodes.PERMISSION_ERROR;
  }
  if (operation === 'writeFile' || operation === 'mkdir') {
    return ErrorCodes.FILE_WRITE_ERROR;
  }
  if (operation === 'unlink') {
    return ErrorCodes.FILE_DELETE_ERROR;
  }
  return ErrorCodes.FILE_READ_ERROR;
}

function wrapError(err, operation, filePath) {
  const systemCode = err instanceof Error && 'code' in err ? err.code : undefined;
  const code = getErrorCode(systemCode, operation);

  const message =
    code === ErrorCodes.PERMISSION_ERROR
      ? `Permission denied: ${operation} on ${filePath}`
      : `File system error during ${operation} on ${filePath}: ${err instanceof Error ? err.message : String(err)}`;

  return new NrsError(message, code, {
    path: filePath,
    operation,
    ...(systemCode ? { systemCode } : {}),
  });
}

export async function readFile(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return await fs.promises.readFile(resolved, 'utf-8');
  } catch (err) {
    throw wrapError(err, 'readFile', resolved);
  }
}

export async function readFileBuffer(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return await fs.promises.readFile(resolved);
  } catch (err) {
    throw wrapError(err, 'readFile', resolved);
  }
}

export async function writeFile(filePath, content) {
  const resolved = path.resolve(filePath);
  try {
    await fs.promises.writeFile(resolved, content, 'utf-8');
  } catch (err) {
    throw wrapError(err, 'writeFile', resolved);
  }
}

export async function readdir(dirPath) {
  const resolved = path.resolve(dirPath);
  try {
    return await fs.promises.readdir(resolved);
  } catch (err) {
    throw wrapError(err, 'readdir', resolved);
  }
}

export async function unlink(filePath) {
  const resolved = path.resolve(filePath);
  try {
    await fs.promises.unlink(resolved);
  } catch (err) {
    throw wrapError(err, 'unlink', resolved);
  }
}

export async function mkdir(dirPath, options) {
  const resolved = path.resolve(dirPath);
  try {
    await fs.promises.mkdir(resolved, { recursive: options?.recursive ?? true });
  } catch (err) {
    throw wrapError(err, 'mkdir', resolved);
  }
}

export async function stat(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return await fs.promises.stat(resolved);
  } catch (err) {
    throw wrapError(err, 'stat', resolved);
  }
}

export async function access(filePath, mode) {
  const resolved = path.resolve(filePath);
  try {
    await fs.promises.access(resolved, mode);
  } catch (err) {
    throw wrapError(err, 'access', resolved);
  }
}

export function joinPath(...segments) {
  return path.join(...segments);
}

export function resolvePath(...segments) {
  return path.resolve(...segments);
}
