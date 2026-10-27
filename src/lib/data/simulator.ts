import type { Match, Score, StandingRow } from "../types";

export type SimulatorFixture = Pick<
  Match,
  "id" | "homeTeamId" | "awayTeamId" | "round" | "kickoff"
>;
export interface SimulatorPick extends Score {
  id: string;
}

export const MAX_SCENARIO_GOALS = 20;
const MAX_PICKS = 40;

/** A small, current snapshot: three upcoming matchdays, with no played results editable. */
export function simulatorFixtures(
  matches: Match[],
  competitionId: string,
  season: string,
  now: number = Date.now(),
): SimulatorFixture[] {
  const pending = matches
    .filter(
      (m) =>
        m.competitionId === competitionId &&
        m.season === season &&
        m.status === "scheduled" &&
        Date.parse(m.kickoff) > now,
    )
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));
  const rounds = [...new Set(pending.map((m) => m.round))].slice(0, 3);
  return pending
    .filter((m) => rounds.includes(m.round))
    .slice(0, MAX_PICKS)
    .map(({ id, homeTeamId, awayTeamId, round, kickoff }) => ({
      id,
      homeTeamId,
      awayTeamId,
      round,
      kickoff,
    }));
}

function validScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_SCENARIO_GOALS;
}

/** Shared links are untrusted; accept only available fixtures and bounded integer scores. */
export function parseSimulatorPicks(
  raw: string | undefined,
  fixtures: SimulatorFixture[],
): SimulatorPick[] {
  if (!raw || raw.length > 12_000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_PICKS) return [];
    const ids = new Set(fixtures.map((m) => m.id));
    const picks = new Map<string, SimulatorPick>();
    for (const row of parsed) {
      if (!Array.isArray(row) || row.length !== 3) continue;
      const [id, home, away] = row;
      if (typeof id === "string" && ids.has(id) && validScore(home) && validScore(away)) {
        picks.set(id, { id, home, away });
      }
    }
    return [...picks.values()];
  } catch {
    return [];
  }
}

export function serializeSimulatorPicks(picks: SimulatorPick[]): string {
  return JSON.stringify(picks.map(({ id, home, away }) => [id, home, away]));
}

/**
 * Apply imagined results to the current table, entirely in the browser.
 * The source table and fixtures remain untouched. Unpicked matches do not count.
 * Ranking follows the site's table: points, GD, goals scored, stable club order.
 * This intentionally does not claim to implement every official competition tie-break.
 */
export function projectTable(
  baseline: StandingRow[],
  fixtures: SimulatorFixture[],
  picks: SimulatorPick[],
  teamOrder: string[],
): StandingRow[] {
  const rows = baseline.map((r) => ({ ...r, form: [...r.form] }));
  const byTeam = new Map(rows.map((r) => [r.teamId, r]));
  const byFixture = new Map(fixtures.map((m) => [m.id, m]));
  const unique = new Map(picks.map((p) => [p.id, p]));
  for (const p of unique.values()) {
    const fixture = byFixture.get(p.id);
    if (!fixture || !validScore(p.home) || !validScore(p.away)) continue;
    const home = byTeam.get(fixture.homeTeamId);
    const away = byTeam.get(fixture.awayTeamId);
    if (!home || !away || home === away) continue;
    home.played++;
    away.played++;
    home.goalsFor += p.home;
    home.goalsAgainst += p.away;
    away.goalsFor += p.away;
    away.goalsAgainst += p.home;
    if (p.home === p.away) {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    } else {
      const winner = p.home > p.away ? home : away;
      const loser = p.home > p.away ? away : home;
      winner.won++;
      winner.points += 3;
      loser.lost++;
    }
  }
  const order = new Map(teamOrder.map((id, i) => [id, i]));
  for (const row of rows) row.goalDifference = row.goalsFor - row.goalsAgainst;
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      (order.get(a.teamId) ?? 0) - (order.get(b.teamId) ?? 0),
  );
  const before = new Map(baseline.map((r) => [r.teamId, r.position]));
  return rows.map((r, i) => ({
    ...r,
    position: i + 1,
    movement: (before.get(r.teamId) ?? i + 1) - (i + 1),
  }));
}
