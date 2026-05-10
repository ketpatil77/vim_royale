import { useCallback, useEffect, useRef, useState } from "react";
import type { Phase, BufferState, DuelState, DuelActions } from "./types";
import { INITIAL_BUFFER, FIXED_LINES, BUGGY_LINES, PATCHES } from "./constants";
import { buildScript, getCmdBar } from "./script";

interface UseDuelMachineProps {
  autoLoop?: boolean;
  loopDelay?: number;
}

export function useDuelMachine({ autoLoop = true, loopDelay = 2600 }: UseDuelMachineProps): DuelState & DuelActions {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [cdVal, setCdVal] = useState<number | "GO!">(3);
  const [p1, setP1] = useState<BufferState>(INITIAL_BUFFER);
  const [p2, setP2] = useState<BufferState>(INITIAL_BUFFER);
  const [p2Glitch, setP2Glitch] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const after = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  const reset = useCallback(() => {
    clear();
    setPhase("countdown");
    setCdVal(3);
    setP1(INITIAL_BUFFER());
    setP2(INITIAL_BUFFER());
    setP2Glitch(false);
  }, [clear]);

  useEffect(() => {
    if (phase !== "countdown") return;
    const vals: Array<number | "GO!"> = [3, 2, 1, "GO!"];
    let i = 0;
    const tick = () => {
      setCdVal(vals[i++]);
      if (i < vals.length) after(700, tick);
      else after(450, () => setPhase("editing"));
    };
    after(300, tick);
  }, [phase, after]);

  useEffect(() => {
    if (phase !== "editing") return;
    const s1 = buildScript(false);
    const s2 = buildScript(true);
    let p1done = false;

    const runScript = (
      script: ReturnType<typeof buildScript>,
      setter: React.Dispatch<React.SetStateAction<BufferState>>,
      onDone: () => void,
    ) => {
      let idx = 0;
      let currentLines = [...BUGGY_LINES];

      const step = () => {
        const s = script[idx];
        if (s.patch !== undefined) {
          currentLines = PATCHES[s.patch](currentLines);
        }
        setter({
          lines: [...currentLines],
          activeLine: s.activeLine,
          mode: s.desc === "DONE" ? "NORMAL" : s.desc,
          cmdBar: getCmdBar(s),
          stamp: null,
        });
        idx++;
        if (idx < script.length) {
          after(script[idx - 1].delay || 280, step);
        } else {
          setter((prev) => ({ ...prev, lines: [...FIXED_LINES], mode: "NORMAL", cmdBar: "-- NORMAL --" }));
          onDone();
        }
      };
      after(60, step);
    };

    runScript(s1, setP1, () => {
      if (!p1done) {
        p1done = true;
        setP1((prev) => ({ ...prev, lines: [...FIXED_LINES] }));
        setPhase("p1_win");
      }
    });
    runScript(s2, setP2, () => {});
  }, [phase, after]);

  useEffect(() => {
    if (phase !== "p1_win") return;
    setP1((prev) => ({ ...prev, stamp: { text: "★  WINNER", color: "#4ec94e" } }));
    after(900, () => setPhase("eliminate"));
  }, [phase, after]);

  useEffect(() => {
    if (phase !== "eliminate") return;
    setP2Glitch(true);
    after(350, () => setP2Glitch(false));

    const deleteNext = () => {
      setP2((prev) => {
        if (prev.lines.length === 0) {
          after(100, finish);
          return prev;
        }
        const next = prev.lines.slice(0, prev.lines.length - 1);
        if (next.length === 0) {
          after(150, finish);
          return { ...prev, lines: [] };
        }
        after(170, deleteNext);
        return { ...prev, lines: next };
      });
    };

    const finish = () => {
      setP2((prev) => ({
        ...prev,
        lines: ["[No Name]  0 lines"],
        mode: "NORMAL",
        cmdBar: "-- NORMAL --",
        stamp: { text: "✗  ELIMINATED", color: "#e06c75" },
      }));
      setPhase("done");
    };

    after(420, deleteNext);
  }, [phase, after]);

  useEffect(() => {
    if (phase !== "done") return;
    if (autoLoop) after(loopDelay, reset);
  }, [phase, after, autoLoop, loopDelay, reset]);

  useEffect(() => () => clear(), [clear]);

  return {
    phase,
    cdVal,
    p1,
    p2,
    p2Glitch,
    setPhase,
    setCdVal,
    setP1,
    setP2,
    setP2Glitch,
    reset,
  };
}