/**
 * Compare deux versions SemVer ("1.2.10" vs "v1.2.9").
 * Retourne 1 si a > b, -1 si a < b, 0 si égales.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => parseInt(part, 10) || 0);

  const pa = parse(a);
  const pb = parse(b);
  const length = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < length; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
