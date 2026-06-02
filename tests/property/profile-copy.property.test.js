import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { join } from "node:path";
import { createProfileStore } from "../../src/store.js";
import { copyCommand } from "../../src/commands.js";
import { createTempDir, cleanupTempDir } from "../helpers/test-fs.js";
import { validProfileName, profileContent } from "../helpers/generators.js";

/**
 * Property 2: Copy preserves content and retains source
 * Validates: Requirements 2.1
 *
 * For any valid profile name and content, copying the profile to a new valid
 * name SHALL result in: (a) the target name containing byte-for-byte identical
 * content to the source; (b) the source profile still existing with unchanged content.
 */
describe("Feature: profile-rename-copy, Property 2: Copy preserves content and retains source", () => {
  it("should preserve content at target and retain source with unchanged content after copy", async () => {
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

            // Copy the profile (non-interactive, no prompt needed)
            await copyCommand(store, srcName, destName, {
              promptFn: async () => true,
              isInteractive: () => false,
            });

            // (a) Target name contains byte-for-byte identical content
            const targetContent = await store.getProfile(destName);
            expect(targetContent).toBe(content);

            // (b) Source profile still exists with unchanged content
            const sourceExists = await store.profileExists(srcName);
            expect(sourceExists).toBe(true);

            const sourceContent = await store.getProfile(srcName);
            expect(sourceContent).toBe(content);
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
 * Property 4: Copy does not affect active marker
 * Validates: Requirements 2.4
 *
 * For any profile (whether active or not), copying it SHALL leave the active
 * profile marker unchanged — the active marker SHALL still point to whatever
 * profile was active before the copy.
 */
describe("Feature: profile-rename-copy, Property 4: Copy does not affect active marker", () => {
  it("should leave active marker unchanged when copying the active profile", async () => {
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

            // Copy the profile
            await copyCommand(store, srcName, destName, {
              promptFn: async () => true,
              isInteractive: () => false,
            });

            // Active marker should still point to the source (unchanged)
            const activeProfile = await store.getActiveProfileName();
            expect(activeProfile).toBe(srcName);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it("should leave active marker unchanged when copying a non-active profile", async () => {
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

            // Copy the non-active profile
            await copyCommand(store, srcName, destName, {
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
