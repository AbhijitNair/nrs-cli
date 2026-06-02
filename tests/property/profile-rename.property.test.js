import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { join } from "node:path";
import { createProfileStore } from "../../src/store.js";
import { renameCommand } from "../../src/commands.js";
import { createTempDir, cleanupTempDir } from "../helpers/test-fs.js";
import { validProfileName, profileContent } from "../helpers/generators.js";

/**
 * Property 1: Rename preserves content and removes source
 * Validates: Requirements 1.1
 *
 * For any valid profile name and content, renaming the profile to a new valid
 * name SHALL result in: (a) the new name containing byte-for-byte identical
 * content to the original; (b) the old name no longer existing in the store.
 */
describe("Feature: profile-rename-copy, Property 1: Rename preserves content and removes source", () => {
  it("should preserve content at new name and remove old name after rename", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        validProfileName,
        profileContent,
        async (srcName, destName, content) => {
          // Ensure source and destination are distinct
          fc.pre(srcName.toLowerCase() !== destName.toLowerCase());

          const tempDir = await createTempDir();
          try {
            const storePath = join(tempDir, "store");
            const npmrcPath = join(tempDir, ".npmrc");

            const store = createProfileStore({ storePath, npmrcPath });
            await store.ensureStoreExists();

            // Write the source profile
            await store.writeProfile(srcName, content);

            // Rename the profile (non-interactive, no prompt needed)
            await renameCommand(store, srcName, destName, {
              promptFn: async () => true,
              isInteractive: () => false,
            });

            // (a) New name contains byte-for-byte identical content
            const newContent = await store.getProfile(destName);
            expect(newContent).toBe(content);

            // (b) Old name no longer exists
            const oldExists = await store.profileExists(srcName);
            expect(oldExists).toBe(false);
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
 * Property 3: Rename updates active marker correctly
 * Validates: Requirements 1.4, 1.5
 *
 * For any profile that is the active profile, renaming it SHALL update the
 * active marker to the new name. For any profile that is NOT the active profile,
 * renaming it SHALL leave the active marker unchanged.
 */
describe("Feature: profile-rename-copy, Property 3: Rename updates active marker correctly", () => {
  it("should update active marker to new name when source was active", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        validProfileName,
        profileContent,
        async (srcName, destName, content) => {
          // Ensure source and destination are distinct
          fc.pre(srcName.toLowerCase() !== destName.toLowerCase());

          const tempDir = await createTempDir();
          try {
            const storePath = join(tempDir, "store");
            const npmrcPath = join(tempDir, ".npmrc");

            const store = createProfileStore({ storePath, npmrcPath });
            await store.ensureStoreExists();

            // Write the source profile and set it as active
            await store.writeProfile(srcName, content);
            await store.setActiveProfileName(srcName);

            // Rename the profile
            await renameCommand(store, srcName, destName, {
              promptFn: async () => true,
              isInteractive: () => false,
            });

            // Active marker should now point to the new name
            const activeProfile = await store.getActiveProfileName();
            expect(activeProfile).toBe(destName);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it("should leave active marker unchanged when source was not active", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        validProfileName,
        validProfileName,
        profileContent,
        profileContent,
        async (srcName, destName, activeName, srcContent, activeContent) => {
          // Ensure all three names are distinct
          fc.pre(
            srcName.toLowerCase() !== destName.toLowerCase() &&
              srcName.toLowerCase() !== activeName.toLowerCase() &&
              destName.toLowerCase() !== activeName.toLowerCase(),
          );

          const tempDir = await createTempDir();
          try {
            const storePath = join(tempDir, "store");
            const npmrcPath = join(tempDir, ".npmrc");

            const store = createProfileStore({ storePath, npmrcPath });
            await store.ensureStoreExists();

            // Write the source profile and a separate active profile
            await store.writeProfile(srcName, srcContent);
            await store.writeProfile(activeName, activeContent);
            await store.setActiveProfileName(activeName);

            // Rename the non-active profile
            await renameCommand(store, srcName, destName, {
              promptFn: async () => true,
              isInteractive: () => false,
            });

            // Active marker should still point to the original active profile
            const activeProfile = await store.getActiveProfileName();
            expect(activeProfile).toBe(activeName);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
