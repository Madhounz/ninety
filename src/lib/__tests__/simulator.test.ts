import { describe, expect, it } from "vitest";
import { computeStandings } from "../data/standings";
import {
  parseSimulatorPicks,
  projectTable,
  serializeSimulatorPicks,
  simulatorFixtures,
} from "../data/simulator";
import type { Match } from "../types";

const ids = ["a", "b", "c", "d"];
function match(id: string, home: string, away: string, round = 2): Match {
  return {
    id,
    slug: id,
    competitionId: "epl",
    season: "2026/27",
    round,
    kickoff: `2026-11-${String(round).padStart(2, "0")}T15:00:00Z`,
    homeTeamId: home,
    awayTeamId: away,
    status: "scheduled",
    phase: "NS",
    minute: null,
    score: null,
    halfTimeScore: null,
  };
}
const played: Match[] = [
  { ...match("old1", "a", "b", 1), status: "finished", phase: "FT", score: { home: 2, away: 0 } },
  { ...match("old2", "c", "d", 1), status: "finished", phase: "FT", score: { home: 0, away: 0 } },
];
const fixtures = [match("next1", "b", "c"), match("next2", "d", "a")];
const baseline = computeStandings("epl", "2026/27", ids, played).rows;

describe("Table Lab arithmetic", () => {
  it("agrees with the existing standings engine for multiple imagined scorelines", () => {
    const picks = [
      { id: "next1", home: 4, away: 1 },
      { id: "next2", home: 2, away: 2 },
    ];
    const projected = projectTable(baseline, fixtures, picks, ids);
    const expected = computeStandings("epl", "2026/27", ids, [
      ...played,
      ...fixtures.map((m, i) => ({ ...m, status: "finished" as const, score: picks[i] })),
    ]).rows;
    for (const row of projected) {
      const other = expected.find((r) => r.teamId === row.teamId)!;
      for (const key of [
        "position",
        "played",
        "won",
        "drawn",
        "lost",
        "goalsFor",
        "goalsAgainst",
        "goalDifference",
        "points",
      ] as const)
        expect(row[key]).toBe(other[key]);
    }
    expect(projected.reduce((n, r) => n + r.goalsFor, 0)).toBe(
      projected.reduce((n, r) => n + r.goalsAgainst, 0),
    );
  });

  it("resetting restores the original table and does not mutate stored results", () => {
    const snapshot = JSON.stringify({ baseline, fixtures });
    projectTable(baseline, fixtures, [{ id: "next1", home: 5, away: 0 }], ids);
    expect(JSON.stringify({ baseline, fixtures })).toBe(snapshot);
    expect(projectTable(baseline, fixtures, [], ids)).toEqual(
      baseline.map((r) => ({ ...r, movement: 0 })),
    );
  });

  it("counts each fixture once and ignores unknown matches or invalid scores", () => {
    const picks = [
      { id: "next1", home: 1, away: 0 },
      { id: "next1", home: 0, away: 0 },
      { id: "old1", home: 9, away: 0 },
      { id: "next2", home: -1, away: 0 },
    ];
    const table = projectTable(baseline, fixtures, picks, ids);
    expect(table.find((r) => r.teamId === "b")).toMatchObject({ played: 2, points: 1, drawn: 1 });
    expect(table.find((r) => r.teamId === "a")).toMatchObject({ played: 1, points: 3 });
  });
});

describe("Table Lab shared links", () => {
  it("round-trips exact scores", () => {
    const picks = [
      { id: "next1", home: 2, away: 1 },
      { id: "next2", home: 0, away: 0 },
    ];
    expect(parseSimulatorPicks(serializeSimulatorPicks(picks), fixtures)).toEqual(picks);
  });

  it.each([
    undefined,
    "{bad",
    "{}",
    '[["next1",-1,0]]',
    '[["next1",1.5,0]]',
    '[["next1","2",0]]',
    '[["next1",21,0]]',
    '[["old1",1,0]]',
    "x".repeat(12001),
  ])("rejects malformed, stale or out-of-range picks: %s", (raw) => {
    expect(parseSimulatorPicks(raw, fixtures)).toEqual([]);
  });

  it("accepts a zero score, caps duplicate picks, and rejects oversized arrays", () => {
    expect(parseSimulatorPicks('[["next1",1,0],["next1",0,0]]', fixtures)).toEqual([
      { id: "next1", home: 0, away: 0 },
    ]);
    expect(parseSimulatorPicks(JSON.stringify(Array(41).fill(["next1", 1, 0])), fixtures)).toEqual(
      [],
    );
  });
});

describe("Table Lab fixture selection", () => {
  it("offers three future matchdays from this competition and season only", () => {
    const now = Date.parse("2026-11-01T00:00:00Z");
    const candidates = [
      ...played,
      ...fixtures,
      match("r3", "a", "c", 3),
      match("r4", "a", "d", 4),
      match("r5", "a", "b", 5),
      { ...match("live", "c", "a"), status: "live" as const },
      { ...match("postponed", "c", "a"), status: "postponed" as const },
      { ...match("other", "c", "a"), competitionId: "other" },
      { ...match("season", "c", "a"), season: "2025/26" },
      { ...match("past", "c", "a"), kickoff: "2026-10-30T15:00:00Z" },
    ];
    expect(simulatorFixtures(candidates, "epl", "2026/27", now).map((m) => m.id)).toEqual([
      "next1",
      "next2",
      "r3",
      "r4",
    ]);
  });
});
