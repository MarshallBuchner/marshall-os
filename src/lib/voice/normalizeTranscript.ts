/**
 * Normalize spoken transcripts for deterministic intent matching.
 * Strips punctuation/wake/politeness noise without inventing meaning.
 */

export function normalizeTranscript(raw: string): string {
  let s = (raw ?? "").toLowerCase();

  // Unify punctuation / quotes → spaces
  s = s.replace(/[“”"']/g, " ");
  s = s.replace(/[.,!?;:…]/g, " ");
  s = s.replace(/[^\w\s-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  if (!s) return "";

  // Optional wake phrasing (explicit mic session — not always-on wake word)
  s = s.replace(/^(hey\s+)?jarvis\s+/, "");

  // Trailing / leading politeness
  s = s.replace(/\bplease\b/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Optional article "a" / "an" before common nouns (transform into a human)
  s = s.replace(/\binto\s+an?\s+/g, "into ");
  s = s.replace(/\bbecome\s+an?\s+/g, "become ");
  s = s.replace(/\bas\s+an?\s+/g, "as ");
  s = s.replace(/\bshow\s+me\s+an?\s+/g, "show me ");
  s = s.replace(/\bshow\s+an?\s+/g, "show ");

  return s.replace(/\s+/g, " ").trim();
}

/** Collapse repeated whitespace; keep original casing for pipeline display */
export function cleanTranscriptDisplay(raw: string): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}
