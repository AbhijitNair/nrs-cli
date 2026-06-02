import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { join } from "node:path";
import { createProfileStore } from "../../src/store.js";
import { renameCommand, copyCommand } from "../../src/commands.js";
import { ErrorCodes } from "../../src/errors.js";
import { createTempDir, cleanupTempDir } from "../helpers/test-fs.js";
import { validProfileName, profileContent } from "../helpers/generators.js";

/**
 * Property 5: Destination conflict in non-interactive mode throws PROFILE_EXISTS
 * Validates: Requirements 1.7, 2.6, 4.3
 *
 * For any rename or copy operation where the destination profile already exists
 * and the mode is non-interactive, the command SHALL throw an NrsError with code
 * PROFILE_EXISTS without modifying any profile data.
 */
describe("Feature: profile-rename-copy, Property 5: Destination conflict in non-interactive mode throws PROFILE_EXISTS", () => {
  it("renameCommand throws PROFILE_EXISTS when destination exists in non-interactive mode", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        validProfileName,
        profileContent,
        profileContent,
        async (srcName, destName, srcContent, destContent) => {
          // Ensure source and destination are distinct
          fc.pre(srcName.toLowerCase() !== destName.toLowerCase());

          const tempDir = await createTempDir();
          try {
            const storePath = join(tempDir, "store");
            const npmrcPath = join(tempDir, ".npmrc");

            const store = createProfileStore({ storePath, npmrcPath });
            await store.ensureStoreExists();

            // Write both source and destination profiles
            await store.writeProfile(srcName, srcContent);
            await store.writeProfile(destName, destContent);

            // Attempt rename in non-interactive mode
            let thrownError;
            try {
              await renameCommand(store, srcName, destName, {
                promptFn: async () => true,
                isInteractive: () => false,
              });
            } catch (err) {
              thrownError = err;
            }

            // Should throw NrsError with PROFILE_EXISTS code
            expect(thrownError).toBeDefined();
            expect(thrownError.name).toBe("NrsError");
            expect(thrownError.code).toBe(ErrorCodes.PROFILE_EXISTS);

            // Original destination content is unchanged
            const destContentAfter = await store.getProfile(destName);
            expect(destContentAfter).toBe(destContent);

            // Source content is unchanged
            const srcContentAfter = await store.getProfile(srcName);
            expect(srcContentAfter).toBe(srcContent);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it("copyCommand throws PROFILE_EXISTS when destination exists in non-interactive mode", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        validProfileName,
        profileContent,
        profileContent,
        async (srcName, destName, srcContent, destContent) => {
          // Ensure source and destination are distinct
          fc.pre(srcName.toLowerCase() !== destName.toLowerCase());

          const tempDir = await createTempDir();
          try {
            const storePath = join(tempDir, "store");
            const npmrcPath = join(tempDir, ".npmrc");

            const store = createProfileStore({ storePath, npmrcPath });
            await store.ensureStoreExists();

            // Write both source and destination profiles
            await store.writeProfile(srcName, srcContent);
            await store.writeProfile(destName, destContent);

            // Attempt copy in non-interactive mode
            let thrownError;
            try {
              await copyCommand(store, srcName, destName, {
                promptFn: async () => true,
                isInteractive: () => false,
              });
            } catch (err) {
              thrownError = err;
            }

            // Should throw NrsError with PROFILE_EXISTS code
            expect(thrownError).toBeDefined();
            expect(thrownError.name).toBe("NrsError");
            expect(thrownError.code).toBe(ErrorCodes.PROFILE_EXISTS);

            // Original destination content is unchanged
            const destContentAfter = await store.getProfile(destName);
            expect(destContentAfter).toBe(destContent);

            // Source content is unchanged
            const srcContentAfter = await store.getProfile(srcName);
            expect(srcContentAfter).toBe(srcContent);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});

/**
 * Property 6: Destination conflict with user confirmation proceeds
 * Validates: Requirements 1.6, 2.5, 4.1
 *
 * For any rename or copy operation where the destination profile already exists
 * and the user confirms the overwrite prompt, the command SHALL complete
 * successfully and the destination SHALL contain the source's content.
 */
describe("Feature: profile-rename-copy, Property 6: Destination conflict with user confirmation proceeds", () => {
  it("renameCommand proceeds when user confirms overwrite", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        validProfileName,
        profileContent,
        profileContent,
        async (srcName, destName, srcContent, destContent) => {
          // Ensure source and destination are distinct
          fc.pre(srcName.toLowerCase() !== destName.toLowerCase());

          const tempDir = await createTempDir();
          try {
            const storePath = join(tempDir, "store");
            const npmrcPath = join(tempDir, ".npmrc");

            const store = createProfileStore({ storePath, npmrcPath });
            await store.ensureStoreExists();

            // Write both source and destination profiles
            await store.writeProfile(srcName, srcContent);
            await store.writeProfile(destName, destContent);

            // Rename with interactive mode and user confirms
            const result = await renameCommand(store, srcName, destName, {
              promptFn: async () => true,
              isInteractive: () => true,
            });

            // Operation completes successfully
            expect(result).toBeDefined();
            expect(result.message).toContain(srcName);
            expect(result.message).toContain(destName);

            // Destination contains source's content
            const destContentAfter = await store.getProfile(destName);
            expect(destContentAfter).toBe(srcContent);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it("copyCommand proceeds when user confirms overwrite", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        validProfileName,
        profileContent,
        profileContent,
        async (srcName, destName, srcContent, destContent) => {
          // Ensure source and destination are distinct
          fc.pre(srcName.toLowerCase() !== destName.toLowerCase());

          const tempDir = await createTempDir();
          try {
            const storePath = join(tempDir, "store");
            const npmrcPath = join(tempDir, ".npmrc");

            const store = createProfileStore({ storePath, npmrcPath });
            await store.ensureStoreExists();

            // Write both source and destination profiles
            await store.writeProfile(srcName, srcContent);
            await store.writeProfile(destName, destContent);

            // Copy with interactive mode and user confirms
            const result = await copyCommand(store, srcName, destName, {
              promptFn: async () => true,
              isInteractive: () => true,
            });

            // Operation completes successfully
            expect(result).toBeDefined();
            expect(result.message).toContain(srcName);
            expect(result.message).toContain(destName);

            // Destination contains source's content
            const destContentAfter = await store.getProfile(destName);
            expect(destContentAfter).toBe(srcContent);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
