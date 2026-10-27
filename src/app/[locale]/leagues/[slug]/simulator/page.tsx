import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { TableLab } from "@/components/TableLab";
import { getRepository } from "@/lib/data";
import { parseSimulatorPicks, simulatorFixtures } from "@/lib/data/simulator";
import { competitionName, teamShortName } from "@/lib/i18n/names";
import { pageMeta } from "@/lib/seo";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "simulator" });
  const c = await (await getRepository()).getCompetitionBySlug(slug);
  if (!c || c.kind !== "league") return {};
  return pageMeta({
    locale,
    path: `/leagues/${slug}/simulator`,
    title: `${t("title")} · ${competitionName(c, locale)}`,
    description: t("lead"),
  });
}

export default async function SimulatorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ p?: string | string[]; club?: string | string[] }>;
}) {
  const repo = await getRepository();
  const c = await repo.getCompetitionBySlug((await params).slug);
  if (!c || c.kind !== "league") notFound();
  const locale = await getLocale();
  const [standings, teams, views, query] = await Promise.all([
    repo.getStandings(c.id),
    repo.listTeams(c.id),
    repo.getCompetitionMatches(c.id),
    searchParams,
  ]);
  const ids = new Set(teams.map((t) => t.id));
  const fixtures = simulatorFixtures(
    views.map((v) => v.match),
    c.id,
    c.season,
  ).filter((m) => ids.has(m.homeTeamId) && ids.has(m.awayTeamId));
  return (
    <TableLab
      key={`${c.id}:${c.season}`}
      baseline={standings.rows}
      fixtures={fixtures}
      teams={teams.map((t) => ({
        id: t.id,
        name: teamShortName(t, locale),
        code: t.code,
        colors: t.colors,
        crestUrl: t.crestUrl,
      }))}
      initialPicks={parseSimulatorPicks(
        typeof query.p === "string" ? query.p : undefined,
        fixtures,
      )}
      initialClub={typeof query.club === "string" && ids.has(query.club) ? query.club : ""}
    />
  );
}
