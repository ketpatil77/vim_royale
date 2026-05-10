import type { FC } from "react";
import type { VimBufferProps } from "./types";
import { LABEL_COLORS } from "./constants";
import { tokenize } from "./tokenize";
import "./HeroEditors.css";

const VimBuffer: FC<VimBufferProps> = ({
  label,
  labelColor,
  lines,
  activeLine,
  mode,
  cmdBar,
  stamp,
  isGlitching = false,
}) => {
  const col = LABEL_COLORS[labelColor];

  return (
    <div className={`vim-buffer ${isGlitching ? "glitching" : ""}`}>
      <div className="vim-buffer-header" style={{ color: col }}>
        <span className="vim-buffer-label">[ {label} ]</span>
        <span className="vim-buffer-mode">
          {mode === "INSERT"  ? "-- INSERT --"  :
           mode === "SEARCH"  ? "-- SEARCH --"  :
           mode === "COMMAND" ? "COMMAND"        : "-- NORMAL --"}
        </span>
      </div>

      <div className="vim-buffer-code">
        {lines.map((line, i) => {
          const isActive = i === activeLine;
          const hasBug = /r3\$ult|fi1ter|m@p/.test(line);
          const tokens = tokenize(line);
          return (
            <div key={i} className={`vim-buffer-line ${isActive ? "active" : ""}`}>
              <span className="vim-buffer-line-number">{i + 1}</span>
              <span className="vim-buffer-line-content">
                {tokens.map((tok, ti) => (
                  <span
                    key={ti}
                    className={
                      tok.type === "keyword" ? "vim-buffer-keyword" :
                      hasBug ? "vim-buffer-bug" : "vim-buffer-normal"
                    }
                  >
                    {tok.text}
                  </span>
                ))}
                {isActive && (
                  <span className="vim-buffer-cursor" style={{ background: col }} />
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="vim-buffer-status">
        <span className={`vim-buffer-status-cmd ${mode === "INSERT" ? "insert" : ""}`}>
          {cmdBar || "-- NORMAL --"}
        </span>
        <span className="vim-buffer-status-filename">buf.js</span>
      </div>

      {stamp && (
        <div
          className={`vim-buffer-stamp ${
            stamp.text.includes("WINNER") ? "win" :
            stamp.text.includes("ELIMINATED") ? "eliminated" : ""
          }`}
        >
          {stamp.text}
        </div>
      )}
    </div>
  );
};

export default VimBuffer;