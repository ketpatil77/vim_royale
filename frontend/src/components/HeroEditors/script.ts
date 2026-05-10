import type { VimStep } from "./types";

export function buildScript(slow: boolean): VimStep[] {
  const base: VimStep[] = [
    { cmd: null,        delay: 0,   desc: "NORMAL",  activeLine: 0 },
    { cmd: "gg",        delay: 400, desc: "NORMAL",  activeLine: 0 },
    { cmd: "2G",        delay: 500, desc: "NORMAL",  activeLine: 1 },
    { cmd: "/r3\\$ult", delay: 600, desc: "SEARCH",  activeLine: 1 },
    { cmd: null,        delay: 400, desc: "NORMAL",  activeLine: 1 },
    { cmd: "ciw",       delay: 500, desc: "INSERT",  activeLine: 1 },
    { cmd: "result",    delay: 800, desc: "INSERT",  activeLine: 1, patch: 0 },
    { cmd: "<Esc>",     delay: 300, desc: "NORMAL",  activeLine: 1 },
    { cmd: "/fi1ter",   delay: 500, desc: "SEARCH",  activeLine: 1 },
    { cmd: null,        delay: 350, desc: "NORMAL",  activeLine: 1 },
    { cmd: "ciw",       delay: 400, desc: "INSERT",  activeLine: 1 },
    { cmd: "filter",    delay: 700, desc: "INSERT",  activeLine: 1, patch: 1 },
    { cmd: "<Esc>",     delay: 300, desc: "NORMAL",  activeLine: 1 },
    { cmd: "3G",        delay: 500, desc: "NORMAL",  activeLine: 2 },
    { cmd: "/r3\\$ult", delay: 500, desc: "SEARCH",  activeLine: 2 },
    { cmd: null,        delay: 350, desc: "NORMAL",  activeLine: 2 },
    { cmd: "ciw",       delay: 400, desc: "INSERT",  activeLine: 2 },
    { cmd: "result",    delay: 700, desc: "INSERT",  activeLine: 2, patch: 2 },
    { cmd: "<Esc>",     delay: 300, desc: "NORMAL",  activeLine: 2 },
    { cmd: "/m@p",      delay: 500, desc: "SEARCH",  activeLine: 2 },
    { cmd: null,        delay: 350, desc: "NORMAL",  activeLine: 2 },
    { cmd: "ciw",       delay: 400, desc: "INSERT",  activeLine: 2 },
    { cmd: "map",       delay: 600, desc: "INSERT",  activeLine: 2, patch: 3 },
    { cmd: "<Esc>",     delay: 300, desc: "NORMAL",  activeLine: 2 },
    { cmd: ":w",        delay: 500, desc: "COMMAND", activeLine: 2 },
    { cmd: null,        delay: 400, desc: "DONE",    activeLine: 2 },
  ];
  if (!slow) return base;
  return base.map((s) => ({
    ...s,
    delay: Math.round(s.delay * 1.85 + Math.random() * 100),
  }));
}

export function getCmdBar(s: VimStep): string {
  if (s.desc === "INSERT") return "-- INSERT --";
  if (s.desc === "SEARCH" && s.cmd) return "/" + s.cmd.replace(/\\\\/g, "");
  if (s.desc === "COMMAND" && s.cmd) return s.cmd;
  return "-- NORMAL --";
}