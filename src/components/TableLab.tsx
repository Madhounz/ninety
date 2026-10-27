"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_SCENARIO_GOALS, projectTable, serializeSimulatorPicks } from "@/lib/data/simulator";
import type { SimulatorFixture, SimulatorPick } from "@/lib/data/simulator";
import type { StandingRow, Team } from "@/lib/types";
import { LocalTime } from "./LocalTime";
import { TeamCrest } from "./TeamCrest";

type LabTeam = Pick<Team, "id" | "name" | "code" | "colors" | "crestUrl">;
const button =
  "min-h-11 rounded-lg border border-line px-3 text-xs font-medium transition-colors hover:border-line-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";

export function TableLab({
  baseline,
  fixtures,
  teams,
  initialPicks,
  initialClub,
}: {
  baseline: StandingRow[];
  fixtures: SimulatorFixture[];
  teams: LabTeam[];
  initialPicks: SimulatorPick[];
  initialClub: string;
}) {
  const t = useTranslations("simulator");
  const tl = useTranslations("league");
  const rounds = [...new Set(fixtures.map((m) => m.round))];
  const [round, setRound] = useState(
    () => fixtures.find((m) => initialPicks.some((p) => p.id === m.id))?.round ?? rounds[0],
  );
  const [picks, setPicks] = useState(initialPicks);
  const [club, setClub] = useState(initialClub);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [shareLink, setShareLink] = useState("");
  const teamOrder = useMemo(() => teams.map((team) => team.id), [teams]);
  const byTeam = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const projected = useMemo(
    () => projectTable(baseline, fixtures, picks, teamOrder),
    [baseline, fixtures, picks, teamOrder],
  );
  const before = useMemo(() => new Map(baseline.map((row) => [row.teamId, row])), [baseline]);
  const shown = fixtures.filter((m) => m.round === round);
  const selected = projected.find((row) => row.teamId === club);
  const moved = projected.filter((row) => row.movement !== 0);

  function choose(id: string, home: number, away: number) {
    setPicks((old) => [...old.filter((p) => p.id !== id), { id, home, away }]);
    setShareStatus("idle");
  }
  function clear(id?: string) {
    setPicks((old) => (id ? old.filter((p) => p.id !== id) : []));
    setShareStatus("idle");
  }
  async function share() {
    const url = new URL(window.location.href);
    url.search = "";
    if (picks.length) url.searchParams.set("p", serializeSimulatorPicks(picks));
    if (club) url.searchParams.set("club", club);
    url.hash = "";
    setShareLink(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setShareStatus("copied");
    } catch {
      setShareStatus("manual");
    }
  }

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-card border border-accent/25 bg-accent-soft/50 p-5 sm:p-7"
        aria-labelledby="lab-title"
      >
        <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          {t("eyebrow")}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl">
            <h2 id="lab-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("headline")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t("lead")}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={button}
              onClick={() => clear()}
              disabled={!picks.length}
            >
              {t("reset")}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg bg-accent px-4 text-xs font-semibold text-bg transition-opacity hover:opacity-85"
              onClick={share}
            >
              {t("share")}
            </button>
          </div>
        </div>
        <p role="status" className="mt-3 text-xs text-accent">
          {shareStatus === "copied"
            ? t("copied")
            : shareStatus === "manual"
              ? t("copyManually")
              : t("private")}
        </p>
        {shareStatus === "manual" && (
          <input
            aria-label={t("shareUrl")}
            className="mt-2 w-full rounded-lg border border-line bg-surface p-3 text-xs"
            readOnly
            value={shareLink}
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </section>

      {fixtures.length === 0 ? (
        <p className="card p-6 text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-3" aria-labelledby="lab-fixtures">
            <div className="flex items-center justify-between gap-3">
              <h3 id="lab-fixtures" className="scroll-mt-36 text-sm font-semibold">
                {t("setResults")}
              </h3>
              <label className="text-xs text-muted">
                <span className="sr-only">{t("chooseRound")}</span>
                <select
                  value={round}
                  onChange={(e) => setRound(Number(e.target.value))}
                  className="min-h-11 rounded-lg border border-line bg-surface px-3 text-ink"
                >
                  {rounds.map((n) => (
                    <option key={n} value={n}>
                      {t("round", { n })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-3">
              {shown.map((fixture) => {
                const home = byTeam.get(fixture.homeTeamId)!;
                const away = byTeam.get(fixture.awayTeamId)!;
                const pick = picks.find((p) => p.id === fixture.id);
                return (
                  <article
                    key={fixture.id}
                    className={`card p-4 transition-colors ${pick ? "border-accent/40" : ""}`}
                  >
                    <div className="mb-4 flex min-h-6 items-center justify-between gap-2 text-[10px] text-muted">
                      <LocalTime iso={fixture.kickoff} withDate />
                      {pick && (
                        <button
                          type="button"
                          className="-my-2 min-h-11 px-2 text-muted hover:text-ink"
                          onClick={() => clear(fixture.id)}
                          aria-label={t("clearMatch", { home: home.name, away: away.name })}
                        >
                          {t("clear")}
                        </button>
                      )}
                    </div>
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] items-center gap-2"
                      dir="ltr"
                    >
                      <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                        <TeamCrest team={home} size={30} />
                        <span className="text-xs font-semibold leading-snug" dir="auto">
                          {home.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        {(["home", "away"] as const).map((side, i) => (
                          <span key={side} className="contents">
                            {i === 1 && (
                              <span className="text-faint" aria-hidden="true">
                                :
                              </span>
                            )}
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={MAX_SCENARIO_GOALS}
                              step={1}
                              aria-label={t("goalsFor", {
                                team: side === "home" ? home.name : away.name,
                              })}
                              placeholder="–"
                              value={pick?.[side] ?? ""}
                              className={`tnum h-12 w-11 rounded-lg border text-center text-xl font-semibold outline-none ${pick ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink"}`}
                              onChange={(e) => {
                                if (e.target.value === "") return clear(fixture.id);
                                const value = Number(e.target.value);
                                if (
                                  !Number.isInteger(value) ||
                                  value < 0 ||
                                  value > MAX_SCENARIO_GOALS
                                )
                                  return;
                                choose(
                                  fixture.id,
                                  side === "home" ? value : (pick?.home ?? 0),
                                  side === "away" ? value : (pick?.away ?? 0),
                                );
                              }}
                            />
                          </span>
                        ))}
                      </div>
                      <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                        <TeamCrest team={away} size={30} />
                        <span className="text-xs font-semibold leading-snug" dir="auto">
                          {away.name}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2" dir="ltr">
                      {[
                        {
                          home: 1,
                          away: 0,
                          label: t("home"),
                          name: t("homeWin", { team: home.name }),
                        },
                        { home: 0, away: 0, label: t("draw"), name: t("drawScore") },
                        {
                          home: 0,
                          away: 1,
                          label: t("away"),
                          name: t("awayWin", { team: away.name }),
                        },
                      ].map((preset, index) => (
                        <button
                          key={index}
                          type="button"
                          className={`${button} ${pick?.home === preset.home && pick?.away === preset.away ? "border-accent/40 bg-accent-soft text-accent" : ""}`}
                          aria-label={preset.name}
                          aria-pressed={pick?.home === preset.home && pick?.away === preset.away}
                          onClick={() => choose(fixture.id, preset.home, preset.away)}
                        >
                          <span className="me-1.5 font-mono text-faint">
                            {["1", "X", "2"][index]}
                          </span>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed text-muted">{t("snapshot")}</p>
          </section>

          <section
            id="lab-table"
            className="min-w-0 scroll-mt-36 space-y-3 lg:sticky lg:top-36"
            aria-labelledby="lab-table-title"
          >
            <div className="flex min-h-11 items-center justify-between gap-2">
              <h3 id="lab-table-title" className="text-sm font-semibold">
                {t("projected")}
              </h3>
              <span className="rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[10px] font-medium text-accent">
                {t("pickCount", { n: picks.length })}
              </span>
            </div>
            <div className="card overflow-hidden">
              <div className="border-b border-line bg-surface-2/40 p-4">
                <label className="flex items-center justify-between gap-3 text-xs text-muted">
                  {t("focus")}
                  <select
                    className="min-h-11 max-w-[65%] rounded-lg border border-line bg-surface px-2 text-ink"
                    value={club}
                    onChange={(e) => {
                      setClub(e.target.value);
                      setShareStatus("idle");
                    }}
                  >
                    <option value="">{t("allClubs")}</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-2 min-h-5 text-xs font-medium text-ink"
                >
                  {selected
                    ? t("clubSummary", {
                        team: byTeam.get(selected.teamId)!.name,
                        before: before.get(selected.teamId)!.position,
                        after: selected.position,
                        points: selected.points,
                      })
                    : picks.length
                      ? t("movement", { n: moved.length })
                      : t("start")}
                </p>
              </div>
              <table className="tnum w-full text-xs">
                <caption className="sr-only">{t("projected")}</caption>
                <thead className="border-b border-line text-[10px] text-muted">
                  <tr>
                    <th scope="col" className="w-9 py-3 ps-3 text-start">
                      {tl("th.pos")}
                    </th>
                    <th scope="col" className="py-3 text-start">
                      {tl("th.club")}
                    </th>
                    <th scope="col" className="w-8 text-center">
                      {tl("th.p")}
                    </th>
                    <th scope="col" className="w-9 text-center">
                      {tl("th.gd")}
                    </th>
                    <th scope="col" className="w-10 text-center">
                      {tl("th.pts")}
                    </th>
                    <th scope="col" className="w-12 pe-2 text-center">
                      <span aria-hidden="true">↕</span>
                      <span className="sr-only">{t("change")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projected.map((row) => {
                    const team = byTeam.get(row.teamId);
                    if (!team) return null;
                    const delta = row.points - before.get(row.teamId)!.points;
                    return (
                      <tr
                        key={row.teamId}
                        className={`border-b border-line last:border-0 ${club === row.teamId ? "bg-accent-soft" : delta ? "bg-accent-soft/20" : ""}`}
                      >
                        <td className="py-3 ps-3 text-muted">{row.position}</td>
                        <th scope="row" className="py-3 text-start font-medium">
                          <span className="flex items-center gap-2">
                            <TeamCrest team={team} size={18} />
                            <span className="min-w-0">{team.name}</span>
                          </span>
                        </th>
                        <td className="text-center text-muted">{row.played}</td>
                        <td className="text-center text-muted" dir="ltr">
                          {row.goalDifference > 0 ? "+" : ""}
                          {row.goalDifference}
                        </td>
                        <td className="text-center font-semibold">{row.points}</td>
                        <td
                          className={`pe-2 text-center text-[10px] font-medium ${row.movement > 0 ? "text-win" : row.movement < 0 ? "text-loss" : "text-faint"}`}
                        >
                          <span aria-label={t("positionChange", { n: row.movement })}>
                            {row.movement > 0
                              ? `↑${row.movement}`
                              : row.movement < 0
                                ? `↓${-row.movement}`
                                : "–"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] leading-relaxed text-muted">{t("rules")}</p>
            <a
              href="#lab-fixtures"
              className="inline-flex min-h-11 items-center text-xs font-semibold text-accent lg:hidden"
            >
              {t("backToPicks")}
            </a>
          </section>
        </div>
      )}
      {picks.length > 0 && (
        <a
          href="#lab-table"
          className="fixed inset-x-4 bottom-20 z-30 mx-auto flex min-h-12 max-w-md items-center justify-between gap-3 rounded-xl border border-accent/40 bg-surface px-4 py-2 shadow-lg lg:hidden"
        >
          <span className="min-w-0 truncate text-xs font-medium">
            {selected
              ? `${byTeam.get(selected.teamId)!.name} · #${selected.position}`
              : t("pickCount", { n: picks.length })}
          </span>
          <span className="shrink-0 text-xs font-semibold text-accent">{t("viewTable")} ↑</span>
        </a>
      )}
    </div>
  );
}
