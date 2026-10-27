import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  isSyncRunning: vi.fn(),
  hasMatchesAround: vi.fn(),
  hasRecentRefresh: vi.fn(),
  getRepository: vi.fn(),
  listCompetitions: vi.fn(),
  listTeams: vi.fn(),
}));
vi.mock("../data", () => ({ getRepository: calls.getRepository }));
vi.mock("../pipeline/prisma-store", () => ({
  PrismaSyncStore: class {
    isSyncRunning = calls.isSyncRunning;
    hasMatchesAround = calls.hasMatchesAround;
    hasRecentRefresh = calls.hasRecentRefresh;
  },
}));

import { runLiveRefresh } from "../pipeline/live";

beforeEach(() => {
  vi.resetAllMocks();
  calls.isSyncRunning.mockResolvedValue(false);
  calls.hasMatchesAround.mockResolvedValue(false);
  calls.hasRecentRefresh.mockResolvedValue(true);
  calls.listCompetitions.mockResolvedValue([]);
  calls.listTeams.mockResolvedValue([]);
  calls.getRepository.mockResolvedValue(calls);
});

describe("refresh workload", () => {
  it("skips quiet-period processing before loading teams or fetching providers", async () => {
    expect((await runLiveRefresh()).ran).toBe(false);
    expect(calls.hasRecentRefresh).toHaveBeenCalledWith(15);
    expect(calls.getRepository).not.toHaveBeenCalled();
  });

  it("does not throttle matches near kick-off", async () => {
    calls.hasMatchesAround.mockResolvedValue(true);
    await runLiveRefresh();
    expect(calls.hasRecentRefresh).not.toHaveBeenCalled();
    expect(calls.getRepository).toHaveBeenCalled();
  });

  it("refreshes quiet periods when the previous success is old or missing", async () => {
    calls.hasRecentRefresh.mockResolvedValue(false);
    await runLiveRefresh();
    expect(calls.getRepository).toHaveBeenCalled();
  });

  it("allows a forced recovery run to bypass both guards", async () => {
    calls.isSyncRunning.mockResolvedValue(true);
    await runLiveRefresh({ force: true });
    expect(calls.isSyncRunning).not.toHaveBeenCalled();
    expect(calls.hasRecentRefresh).not.toHaveBeenCalled();
    expect(calls.getRepository).toHaveBeenCalled();
  });
});
