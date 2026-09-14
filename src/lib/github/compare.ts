export type CompareSideStats = {
  login: string;
  total: number;
  streak: number;
  consistency: number;
};

export type CompareDeltaMetric = {
  key: "total" | "streak" | "consistency";
  label: string;
  leftValue: string;
  rightValue: string;
  leader: "left" | "right" | "tie";
  note: string;
};

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

function leaderOf(diff: number): "left" | "right" | "tie" {
  if (diff > 0) return "left";
  if (diff < 0) return "right";
  return "tie";
}

function leadNote(
  left: CompareSideStats,
  right: CompareSideStats,
  diff: number,
  formatted: string,
): string {
  if (diff === 0) return "tied";
  const who = diff > 0 ? left.login : right.login;
  return `${who} +${formatted}`;
}

export function compareDelta(
  left: CompareSideStats,
  right: CompareSideStats,
): CompareDeltaMetric[] {
  const totalDiff = left.total - right.total;
  const streakDiff = left.streak - right.streak;
  const leftPct = Math.round(left.consistency * 100);
  const rightPct = Math.round(right.consistency * 100);
  const consDiff = leftPct - rightPct;

  return [
    {
      key: "total",
      label: "Volume",
      leftValue: formatCount(left.total),
      rightValue: formatCount(right.total),
      leader: leaderOf(totalDiff),
      note: leadNote(left, right, totalDiff, formatCount(Math.abs(totalDiff))),
    },
    {
      key: "streak",
      label: "Streak",
      leftValue: `${left.streak}d`,
      rightValue: `${right.streak}d`,
      leader: leaderOf(streakDiff),
      note: leadNote(left, right, streakDiff, `${Math.abs(streakDiff)}d`),
    },
    {
      key: "consistency",
      label: "Consistency",
      leftValue: `${leftPct}%`,
      rightValue: `${rightPct}%`,
      leader: leaderOf(consDiff),
      note: leadNote(left, right, consDiff, `${Math.abs(consDiff)}pp`),
    },
  ];
}
