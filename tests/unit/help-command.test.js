import { describe, it, expect } from 'vitest';
import { helpCommand } from '../../src/commands.js';

describe('helpCommand', () => {
  it('returns a non-empty string', () => {
    const output = helpCommand();
    expect(output).toBeTruthy();
  });

  it('includes the tool name and description', () => {
    const output = helpCommand();
    expect(output).toContain('nrs');
    expect(output).toContain('NPM Registry Switcher');
  });

  it('lists the list command with description', () => {
    const output = helpCommand();
    expect(output).toContain('list');
    expect(output).toContain('List all profiles');
    expect(output).toContain('active profile marked with *');
  });

  it('lists the list full command with description', () => {
    const output = helpCommand();
    expect(output).toContain('list full');
    expect(output).toContain('List all profiles with registry URLs');
  });

  it('lists the use command with description', () => {
    const output = helpCommand();
    expect(output).toContain('use <profile>');
    expect(output).toContain('Switch to a profile');
  });

  it('lists the set command with description', () => {
    const output = helpCommand();
    expect(output).toContain('set registry=');
    expect(output).toContain('Create or update a profile');
  });

  it('lists the delete command with description', () => {
    const output = helpCommand();
    expect(output).toContain('delete <profile>');
    expect(output).toContain('Delete a profile');
  });

  it('lists the help command with description', () => {
    const output = helpCommand();
    expect(output).toContain('help');
    expect(output).toContain('Show this help message');
  });

  it('includes the --version flag', () => {
    const output = helpCommand();
    expect(output).toContain('--version');
    expect(output).toContain('Show version number');
  });

  it('is synchronous and returns a string', () => {
    const output = helpCommand();
    expect(typeof output).toBe('string');
  });
});
