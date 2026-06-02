/**
 * Error codes for all NRS error conditions.
 */
export const ErrorCodes = {
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  AMBIGUOUS_MATCH: 'AMBIGUOUS_MATCH',
  INVALID_PROFILE_NAME: 'INVALID_PROFILE_NAME',
  MISSING_ARGUMENT: 'MISSING_ARGUMENT',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_DELETE_ERROR: 'FILE_DELETE_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  HOME_DIR_ERROR: 'HOME_DIR_ERROR',
  INVALID_PATH: 'INVALID_PATH',
  SWITCH_ABORTED: 'SWITCH_ABORTED',
  PROFILE_EXISTS: 'PROFILE_EXISTS',
};

/**
 * Custom error class for NRS with structured error code and optional details.
 */
export class NrsError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'NrsError';
    this.code = code;
    this.details = details;
  }
}
