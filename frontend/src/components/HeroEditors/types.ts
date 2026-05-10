export type Phase = "countdown" | "editing" | "p1_win" | "eliminate" | "done";

export type VimMode = "NORMAL" | "INSERT" | "SEARCH" | "COMMAND" | "DONE";

export type LabelColor = "green" | "amber" | "red" | "blue";

export interface VimStep {
  cmd: string | null;
  delay: number;
  desc: VimMode;
  activeLine: number;
  patch?: number;
}

export interface Stamp {
  text: string;
  color: string;
}

export interface BufferState {
  lines: string[];
  activeLine: number;
  mode: VimMode;
  cmdBar: string;
  stamp: Stamp | null;
}

export interface VimBufferProps {
  label: string;
  labelColor: LabelColor;
  lines: string[];
  activeLine: number;
  mode: VimMode;
  cmdBar: string;
  stamp: Stamp | null;
  isGlitching?: boolean;
}

export interface CountdownOverlayProps {
  value: number | "GO!";
}

export interface VimRoyaleDuelProps {
  p1Label?: string;
  p2Label?: string;
  autoLoop?: boolean;
  loopDelay?: number;
}

export interface Token {
  text: string;
  type: "keyword" | "normal";
}

export interface DuelState {
  phase: Phase;
  cdVal: number | "GO!";
  p1: BufferState;
  p2: BufferState;
  p2Glitch: boolean;
}

export interface DuelActions {
  setPhase: (phase: Phase) => void;
  setCdVal: (val: number | "GO!") => void;
  setP1: React.Dispatch<React.SetStateAction<BufferState>>;
  setP2: React.Dispatch<React.SetStateAction<BufferState>>;
  setP2Glitch: (glitch: boolean) => void;
  reset: () => void;
}