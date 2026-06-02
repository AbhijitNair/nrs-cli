import { describe, it, expect } from 'vitest';
import { NrsError, ErrorCodes } from '../../src/errors.js';

describe('ErrorCodes', () => {
  it('defines all expected error code strings', () => {
    expect(ErrorCodes.PROFILE_NOT_FOUND).toBe('PROFILE_NOT_FOUND');
    expect(ErrorCodes.AMBIGUOUS_MATCH).toBe('AMBIGUOUS_MATCH');
    expect(ErrorCodes.INVALID_PROFILE_NAME).toBe('INVALID_PROFILE_NAME');
    expect(ErrorCodes.MISSING_ARGUMENT).toBe('MISSING_ARGUMENT');
    expect(ErrorCodes.FILE_WRITE_ERROR).toBe('FILE_WRITE_ERROR');
    expect(ErrorCodes.FILE_READ_ERROR).toBe('FILE_READ_ERROR');
    expect(ErrorCodes.FILE_DELETE_ERROR).toBe('FILE_DELETE_ERROR');
    expect(ErrorCodes.PERMISSION_ERROR).toBe('PERMISSION_ERROR');
    expect(ErrorCodes.HOME_DIR_ERROR).toBe('HOME_DIR_ERROR');
    expect(ErrorCodes.INVALID_PATH).toBe('INVALID_PATH');
    expect(ErrorCodes.SWITCH_ABORTED).toBe('SWITCH_ABORTED');
    expect(ErrorCodes.PROFILE_EXISTS).toBe('PROFILE_EXISTS');
  });

  it('contains exactly 12 error codes', () => {
    expect(Object.keys(ErrorCodes)).toHaveLength(12);
  });
});

describe('NrsError', () => {
  it('extends Error', () => {
    const error = new NrsError('test message', ErrorCodes.PROFILE_NOT_FOUND);
    expect(error).toBeInstanceOf(Error);
  });

  it('sets message, code, and name correctly', () => {
    const error = new NrsError('Profile not found', ErrorCodes.PROFILE_NOT_FOUND);
    expect(error.message).toBe('Profile not found');
    expect(error.code).toBe('PROFILE_NOT_FOUND');
    expect(error.name).toBe('NrsError');
  });

  it('supports optional details field', () => {
    const details = { profileName: 'work', storePath: '~/.nrs/' };
    const error = new NrsError(
      'Profile not found',
      ErrorCodes.PROFILE_NOT_FOUND,
      details
    );
    expect(error.details).toEqual(details);
  });

  it('has undefined details when not provided', () => {
    const error = new NrsError('Some error', ErrorCodes.FILE_READ_ERROR);
    expect(error.details).toBeUndefined();
  });
});
