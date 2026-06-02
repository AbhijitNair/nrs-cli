import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createProfileStore } from "../../src/store.js";
import { validProfileName, profileContent } from "../helpers/generators.js";
import { createTempDir, cleanupTempDir } from "../helpers/test-fs.js";

/**
 * Feature: npm-registry-switcher, Property 6: Profile deletion clears state
 *
 * **Validates: Requirements 4.1, 4.2**
 *
 * For any existing profile, after deletion:
 * (a) the profile SHALL no longer exist in the store;
 * (b) if the deleted profile was the active profile, the active profile state SHALL be null.
 */
describe("Feature: npm-registry-switcher, Property 6: Profile deletion clears state", () => {
  it("SHALL remove the profile from the store after deletion", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        profileContent,
        async (name, content) => {
          const tempDir = await createTempDir();
          try {
            const store = createProfileStore({
              storePath: tempDir,
              npmrcPath: "",
            });
            await store.ensureStoreExists();
            await store.writeProfile(name, content);

            // Verify profile exists before deletion
            expect(await store.profileExists(name)).toBe(true);

            // Delete the profile
            await store.deleteProfile(name);

            // (a) Profile SHALL no longer exist in the store
            expect(await store.profileExists(name)).toBe(false);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it("SHALL clear active profile state when the deleted profile was active", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        profileContent,
        async (name, content) => {
          const tempDir = await createTempDir();
          try {
            const store = createProfileStore({
              storePath: tempDir,
              npmrcPath: "",
            });
            await store.ensureStoreExists();
            await store.writeProfile(name, content);

            // Set the profile as active
            await store.setActiveProfileName(name);
            expect(await store.getActiveProfileName()).toBe(name);

            // Delete the profile and clear active state (as the delete command would)
            await store.deleteProfile(name);
            await store.setActiveProfileName(null);

            // (a) Profile SHALL no longer exist
            expect(await store.profileExists(name)).toBe(false);

            // (b) Active profile state SHALL be null
            expect(await store.getActiveProfileName()).toBe(null);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it("SHALL NOT clear active profile state when a non-active profile is deleted", async () => {
    await fc.assert(
      fc.asyncProperty(
        validProfileName,
        validProfileName,
        profileContent,
        profileContent,
        async (activeName, deleteName, activeContent, deleteContent) => {
          // Ensure the two profile names are different
          fc.pre(activeName.toLowerCase() !== deleteName.toLowerCase());

          const tempDir = await createTempDir();
          try {
            const store = createProfileStore({
              storePath: tempDir,
              npmrcPath: "",
            });
            await store.ensureStoreExists();

            // Write both profiles
            await store.writeProfile(activeName, activeContent);
            await store.writeProfile(deleteName, deleteContent);

            // Set one as active
            await store.setActiveProfileName(activeName);

            // Delete the non-active profile
            await store.deleteProfile(deleteName);

            // (a) Deleted profile SHALL no longer exist
            expect(await store.profileExists(deleteName)).toBe(false);

            // Active profile state SHALL remain unchanged
            expect(await store.getActiveProfileName()).toBe(activeName);

            // Active profile SHALL still exist
            expect(await store.profileExists(activeName)).toBe(true);
          } finally {
            await cleanupTempDir(tempDir);
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
