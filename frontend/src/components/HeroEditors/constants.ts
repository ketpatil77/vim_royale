import type { LabelColor } from "./types";

export const BUGGY_LINES: string[] = [
  "function processData(input) {",
  "  const r3$ult = input.fi1ter(x => x != null);",
  "  return r3$ult.m@p(x => x * 2);",
  "}",
];

export const FIXED_LINES: string[] = [
  "function processData(input) {",
  "  const result = input.filter(x => x != null);",
  "  return result.map(x => x * 2);",
  "}",
];

export const LABEL_COLORS: Record<LabelColor, string> = {
  green: "#4ec94e",
  amber: "#e5c07b",
  red:   "#e06c75",
  blue:  "#528bff",
};

export const PATCHES: Array<(lines: string[]) => string[]> = [
  (l) => { const n = [...l]; n[1] = n[1].replace(/r3\$ult/, "result");  return n; },
  (l) => { const n = [...l]; n[1] = n[1].replace(/fi1ter/, "filter");   return n; },
  (l) => { const n = [...l]; n[2] = n[2].replace(/r3\$ult/, "result");  return n; },
  (l) => { const n = [...l]; n[2] = n[2].replace(/m@p/,    "map");      return n; },
];

export const INITIAL_BUFFER = (): import("./types").BufferState => ({
  lines: [...BUGGY_LINES],
  activeLine: 0,
  mode: "NORMAL",
  cmdBar: "-- NORMAL --",
  stamp: null,
});

export const PHASE_LABELS: Record<import("./types").Phase, string> = {
  countdown: "loading",
  editing:   "editing",
  p1_win:    "winner!",
  eliminate: "deleting",
  done:      "done",
};