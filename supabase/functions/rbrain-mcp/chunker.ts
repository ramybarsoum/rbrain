// Recursive delimiter-aware chunker. Ported from src/core/chunkers/recursive.ts.
// 5-level hierarchy: paragraphs → lines → sentences → clauses → words.

const DELIMITERS: string[][] = [
  ['\n\n'],
  ['\n'],
  ['. ', '! ', '? ', '.\n', '!\n', '?\n'],
  ['; ', ': ', ', '],
  [],
];

export interface TextChunk { text: string; index: number }

export function chunkText(text: string, chunkSize = 300, chunkOverlap = 50): TextChunk[] {
  if (!text || text.trim().length === 0) return [];
  if (countWords(text) <= chunkSize) return [{ text: text.trim(), index: 0 }];
  const pieces = recursiveSplit(text, 0, chunkSize);
  const merged = greedyMerge(pieces, chunkSize);
  const withOverlap = applyOverlap(merged, chunkOverlap);
  return withOverlap.map((t, i) => ({ text: t.trim(), index: i }));
}

function recursiveSplit(text: string, level: number, target: number): string[] {
  if (level >= DELIMITERS.length) return splitOnWhitespace(text, target);
  const delims = DELIMITERS[level];
  if (delims.length === 0) return splitOnWhitespace(text, target);
  const pieces = splitAtDelimiters(text, delims);
  if (pieces.length <= 1) return recursiveSplit(text, level + 1, target);
  const result: string[] = [];
  for (const p of pieces) {
    if (countWords(p) > target) result.push(...recursiveSplit(p, level + 1, target));
    else result.push(p);
  }
  return result;
}

function splitAtDelimiters(text: string, delimiters: string[]): string[] {
  const pieces: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let earliest = -1;
    let earliestDelim = '';
    for (const d of delimiters) {
      const idx = remaining.indexOf(d);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        earliestDelim = d;
      }
    }
    if (earliest === -1) { pieces.push(remaining); break }
    const piece = remaining.slice(0, earliest + earliestDelim.length);
    if (piece.trim().length > 0) pieces.push(piece);
    remaining = remaining.slice(earliest + earliestDelim.length);
  }
  return pieces.filter(p => p.trim().length > 0);
}

function splitOnWhitespace(text: string, target: number): string[] {
  const words = text.match(/\S+\s*/g) || [];
  if (words.length === 0) return [];
  const pieces: string[] = [];
  for (let i = 0; i < words.length; i += target) {
    const s = words.slice(i, i + target).join('');
    if (s.trim().length > 0) pieces.push(s);
  }
  return pieces;
}

function greedyMerge(pieces: string[], target: number): string[] {
  if (pieces.length === 0) return [];
  const result: string[] = [];
  let current = pieces[0];
  for (let i = 1; i < pieces.length; i++) {
    const combined = current + pieces[i];
    if (countWords(combined) <= Math.ceil(target * 1.5)) current = combined;
    else { result.push(current); current = pieces[i] }
  }
  if (current.trim().length > 0) result.push(current);
  return result;
}

function applyOverlap(chunks: string[], overlapWords: number): string[] {
  if (chunks.length <= 1 || overlapWords <= 0) return chunks;
  const result: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prev = extractTrailing(chunks[i - 1], overlapWords);
    result.push(prev + chunks[i]);
  }
  return result;
}

function extractTrailing(text: string, targetWords: number): string {
  const words = text.match(/\S+\s*/g) || [];
  if (words.length <= targetWords) return '';
  const trailing = words.slice(-targetWords).join('');
  const sStart = trailing.search(/[.!?]\s+/);
  if (sStart !== -1 && sStart < trailing.length / 2) {
    const after = trailing.slice(sStart).replace(/^[.!?]\s+/, '');
    if (after.trim().length > 0) return after;
  }
  return trailing;
}

function countWords(text: string): number {
  return (text.match(/\S+/g) || []).length;
}
