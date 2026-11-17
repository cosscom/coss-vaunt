/** Groups words into visual lines by the top offset each was laid out at. */
export function groupWordsIntoLines(words: readonly { text: string; top: number }[]): string[] {
  const lines: { top: number; words: string[] }[] = [];
  for (const word of words) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(word.top - line.top) < 1) line.words.push(word.text);
    else lines.push({ top: word.top, words: [word.text] });
  }
  return lines.map((line) => line.words.join(" "));
}
