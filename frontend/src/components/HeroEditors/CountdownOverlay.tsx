import type { FC } from "react";
import type { CountdownOverlayProps } from "./types";
import "./HeroEditors.css";

const CountdownOverlay: FC<CountdownOverlayProps> = ({ value }) => (
  <div className="countdown-overlay">
    <div key={String(value)} className="countdown-value">
      {value}
    </div>
    <div className="countdown-label">GET READY</div>
  </div>
);

export default CountdownOverlay;