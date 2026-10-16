export function countCommits(input: {
  reportedTotal: number;
  publicSeen: number;
  privateSeen: number;
}): { total: number; publicTotal: number; privateTotal: number } {
  const seen = input.publicSeen + input.privateSeen;
  const total = Math.max(input.reportedTotal, seen);
  if (seen >= input.reportedTotal) {
    return {
      total: seen,
      publicTotal: input.publicSeen,
      privateTotal: input.privateSeen,
    };
  }
  return {
    total,
    publicTotal: input.publicSeen,
    privateTotal: total - input.publicSeen,
  };
}
