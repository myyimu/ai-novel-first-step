import { DrizzleService } from "./drizzle.service";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("DrizzleService", () => {
  const originalUrl = process.env.DATABASE_URL;
  const originalPgliteDataDir = process.env.PGLITE_DATA_DIR;
  let tempPgliteDataDir: string | undefined;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
    if (originalPgliteDataDir === undefined) {
      delete process.env.PGLITE_DATA_DIR;
    } else {
      process.env.PGLITE_DATA_DIR = originalPgliteDataDir;
    }
    if (tempPgliteDataDir) {
      rmSync(tempPgliteDataDir, { recursive: true, force: true });
      tempPgliteDataDir = undefined;
    }
  });

  describe("when DATABASE_URL is empty (PGlite fallback)", () => {
    beforeEach(() => {
      delete process.env.DATABASE_URL;
      tempPgliteDataDir = mkdtempSync(join(tmpdir(), "ai-novel-pglite-"));
      process.env.PGLITE_DATA_DIR = tempPgliteDataDir;
    });

    it("constructs without throwing and exposes a usable db handle", async () => {
      const svc = new DrizzleService();
      try {
        expect(svc.db).toBeDefined();
        expect(svc.isConfigured()).toBe(false);
      } finally {
        await svc.onModuleDestroy();
      }
    });

    it("onModuleInit bootstraps the schema in-memory", async () => {
      const svc = new DrizzleService();
      await expect(svc.onModuleInit()).resolves.toBeUndefined();
      await svc.onModuleDestroy();
    });

    it("isHealthy returns true once PGlite is ready", async () => {
      const svc = new DrizzleService();
      await expect(svc.isHealthy()).resolves.toBe(true);
      await svc.onModuleDestroy();
    });
  });

  describe("when DATABASE_URL is set", () => {
    beforeEach(() => {
      // Non-reachable host — Pool construction is lazy (no TCP). Tests
      // here exercise the configured branch without dialing.
      process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
    });

    it("constructs the Postgres driver and marks itself configured", async () => {
      const svc = new DrizzleService();
      try {
        expect(svc.db).toBeDefined();
        expect(svc.isConfigured()).toBe(true);
      } finally {
        await svc.onModuleDestroy();
      }
    });
  });

  describe("when DATABASE_URL is whitespace", () => {
    beforeEach(() => {
      process.env.DATABASE_URL = "   ";
      tempPgliteDataDir = mkdtempSync(join(tmpdir(), "ai-novel-pglite-"));
      process.env.PGLITE_DATA_DIR = tempPgliteDataDir;
    });

    it("is treated as empty and falls back to PGlite", async () => {
      const svc = new DrizzleService();
      try {
        expect(svc.isConfigured()).toBe(false);
      } finally {
        await svc.onModuleDestroy();
      }
    });
  });
});
