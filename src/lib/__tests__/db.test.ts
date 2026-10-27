import { afterEach, describe, expect, it, vi } from "vitest";

const constructors = vi.hoisted(() => ({
  adapter: vi.fn(function () {}),
  client: vi.fn(function () {}),
}));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: constructors.adapter }));
vi.mock("@/generated/prisma/client", () => ({ PrismaClient: constructors.client }));

const state = globalThis as unknown as { prisma?: unknown };

afterEach(() => {
  delete state.prisma;
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("database connection reuse", () => {
  it.each(["production", "development"])("shares one connection pool in %s", async (mode) => {
    delete state.prisma;
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/ninety_test");
    const { getPrisma } = await import("../db");
    const clients = await Promise.all(Array.from({ length: 100 }, () => getPrisma()));
    expect(new Set(clients).size).toBe(1);
    expect(constructors.adapter).toHaveBeenCalledTimes(1);
    expect(constructors.client).toHaveBeenCalledTimes(1);
  });
});
