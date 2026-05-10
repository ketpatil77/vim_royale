import type { FC } from "react";
import type { VimRoyaleDuelProps } from "./types";
import { useDuelMachine } from "./useDuelMachine";
import { PHASE_LABELS } from "./constants";
import VimBuffer from "./VimBuffer";
import CountdownOverlay from "./CountdownOverlay";
import "./HeroEditors.css";

const HeroEditors: FC<VimRoyaleDuelProps> = ({
  p1Label = "PLAYER_1",
  p2Label = "PLAYER_2",
  autoLoop = true,
  loopDelay = 2600,
}) => {
  const { phase, cdVal, p1, p2, p2Glitch } = useDuelMachine({ autoLoop, loopDelay });

  return (
    <div className="hero-editors">
      <div className="hero-editors-titlebar">
        {(["#ff5f57", "#febc2e", "#28c840"] as const).map((c, i) => (
          <span key={c} className={`hero-editors-dot ${["red", "yellow", "green"][i]}`} />
        ))}
        <span className="hero-editors-title">vim_royale — duel.js</span>
      </div>

      <div className="hero-editors-arena">
        <div className="hero-editors-player">
          <VimBuffer label={p1Label} labelColor="green" {...p1} />
          {phase === "countdown" && <CountdownOverlay value={cdVal} />}
        </div>

        <div className="hero-editors-vs">
          <span className="hero-editors-vs-label">VS</span>
          <span className="hero-editors-vs-phase">{PHASE_LABELS[phase]}</span>
        </div>

        <div className="hero-editors-player">
          <VimBuffer label={p2Label} labelColor="amber" {...p2} isGlitching={p2Glitch} />
          {phase === "countdown" && <CountdownOverlay value={cdVal} />}
        </div>
      </div>
    </div>
  );
};

export default HeroEditors;