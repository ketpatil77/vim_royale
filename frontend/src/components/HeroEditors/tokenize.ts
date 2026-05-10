import type { Token } from "./types";

export function tokenize(line: string): Token[] {
  const kw = new RegExp(/\b(function|const|return)\b/g);
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = kw.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), type: "normal" });
    tokens.push({ text: m[0], type: "keyword" });
    last = m.index + m[0].length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), type: "normal" });
  return tokens;
}