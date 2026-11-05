/**
 * Word-by-word search used by every search box: each word typed must appear somewhere in the
 * item, in any order. "500 1.5" finds "Mahadeva Atta Noodles 500g 1.5mm"; "500 g" and "500g"
 * match either way (spaces are also ignored when comparing).
 */

/** Words of a search, lowercased. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * How well `fields` match the search words: null = not every word found; higher = better
 * (words found at the start of a word, and at the very start, rank higher).
 */
export function matchScore(words: string[], fields: (string | null | undefined)[]): number | null {
  if (words.length === 0) return 0;
  const text = fields.filter(Boolean).join(" ").toLowerCase();
  const compact = text.replace(/\s+/g, "");
  let score = 0;
  for (const w of words) {
    const at = text.indexOf(w);
    if (at === -1) {
      if (!compact.includes(w)) return null;
      continue;
    }
    if (at === 0) score += 3;
    else if (/[^a-z0-9]/.test(text[at - 1])) score += 2;
    // Later occurrences may start a word even if the first doesn't.
    else if (new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text)) score += 2;
    else score += 1;
  }
  return score;
}

/** The items matching `query`, best matches first (ties keep their order). */
export function searchFilter<T>(items: T[], query: string, fields: (item: T) => (string | null | undefined)[]): T[] {
  const words = searchWords(query);
  if (words.length === 0) return items;
  return items
    .map((item, i) => ({ item, i, score: matchScore(words, fields(item)) }))
    .filter((x): x is { item: T; i: number; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);
}
