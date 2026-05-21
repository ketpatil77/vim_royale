import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeroEditors from "../components/HeroEditors/HeroEditors";
import { TerminalLayout } from "../components/TerminalLayout/TerminalLayout";
import { useCRT } from "../contexts/CRTContext";
import "./Walkthrough.css";

type WalkthroughStep = {
  eyebrow: string;
  title: string;
  summary: string;
  points: string[];
  nextLabel: string;
  panel: "welcome" | "commands" | "modes" | "loop" | "match" | "pollution";
};

const COMMANDS = [
  [":play", "Start a new game"],
  [":leaderboard", "View top players"],
  [":tutor", "Learn vim"],
  [":back", "Go to the previous page"],
  [":home", "Go to the main menu"],
  [":crt", "Toggle CRT effect"],
  [":profile", "Edit your profile"],
];

const STEPS: WalkthroughStep[] = [
  {
    eyebrow: "boot sequence",
    title: "Welcome to Vim Royale",
    summary:
      "Vim Royale is a competitive vim game where two players race to repair corrupted code using vim motions.",
    points: [
      "Move through real editing challenges with vim motions, operators, and commands.",
      "Out-maneuver your opponent by making precise edits faster.",
      "This tour teaches the commands, match flow, and exact-win condition.",
    ],
    nextLabel: "Next: Navigation",
    panel: "welcome",
  },
  {
    eyebrow: "command mode",
    title: "Navigation Commands",
    summary:
      "Press : anywhere outside an input to open the command bar, then type a command and hit Enter.",
    points: [
      "Use terminal commands for the main routes instead of hunting through navigation.",
      ":guide and :walkthrough bring you back to this tour anytime.",
      "Escape closes the command bar or exits this walkthrough.",
    ],
    nextLabel: "Next: Game Modes",
    panel: "commands",
  },
  {
    eyebrow: "match select",
    title: "Game Modes",
    summary:
      "Pick the mode that matches your mood: competitive ranked play, quick timed practice, or a bot warmup.",
    points: [
      "1v1 Multiplayer: race another real player and climb the leaderboard.",
      "Timed Solo: solve as many challenges as possible in three minutes.",
      "vs Computer: practice against bots before queueing up.",
    ],
    nextLabel: "Next: How to Play",
    panel: "modes",
  },
  {
    eyebrow: "core loop",
    title: "How to Play",
    summary:
      "Every round is a tight loop: load the corrupted buffer, fix it, match the hidden target, and win.",
    points: [
      "No mouse is needed. Normal, insert, visual, and command-line modes are your toolkit.",
      "Speed matters, but accuracy is what ends the round.",
      "The game watches the buffer continuously, so the win triggers automatically.",
    ],
    nextLabel: "Next: Match Mechanics",
    panel: "loop",
  },
  {
    eyebrow: "live duel",
    title: "Match Mechanics",
    summary:
      "Matches are split-screen races. Your editor is on the left, your opponent is on the right.",
    points: [
      "Watch their cursor move in real time while you repair your own buffer.",
      "The target solution is hidden, so you infer the clean version from the polluted code.",
      "The round ends the moment your buffer matches the target byte-for-byte.",
    ],
    nextLabel: "Next: Code Pollution",
    panel: "match",
  },
  {
    eyebrow: "cleanup pass",
    title: "Code Pollution",
    summary:
      "Challenges include extra text, noisy structure, and formatting drift that must be removed completely.",
    points: [
      "Remove TODO comments, extra braces, inconsistent whitespace, and expanded operators.",
      "Small leftovers count. A single extra space can keep the round alive.",
      "Your buffer must be exactly identical to the hidden target to win.",
    ],
    nextLabel: "Start Playing",
    panel: "pollution",
  },
];

function HeroEditorsPanel() {
  return (
    <div className="walkthrough-duel-preview">
      <HeroEditors p1Label="YOU" p2Label="RIVAL" loopDelay={2200} />
    </div>
  );
}

function CommandsPanel() {
  return (
    <div className="walkthrough-command-list">
      {COMMANDS.map(([command, description]) => (
        <div className="walkthrough-command-row" key={command}>
          <code>{command}</code>
          <span>{description}</span>
        </div>
      ))}
    </div>
  );
}

function ModesPanel() {
  const modes = [
    ["1v1", "Multiplayer", "Ranked pressure with a live opponent."],
    ["2:00", "Timed solo", "A compact practice sprint against the clock."],
    ["BOT", "vs Computer", "Warm up against predictable difficulty tiers."],
  ];

  return (
    <div className="walkthrough-mode-grid">
      {modes.map(([tag, title, description]) => (
        <div className="walkthrough-mode" key={tag}>
          <span>{tag}</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
      ))}
    </div>
  );
}

function LoopPanel() {
  const loop = [
    ["01", "LOAD", "A corrupted challenge opens."],
    ["02", "FIX", "Repair with vim edits."],
    ["03", "MATCH", "Buffer equals target."],
    ["04", "WIN", "First exact match wins."],
  ];

  return (
    <div className="walkthrough-loop">
      {loop.map(([number, label, description]) => (
        <div className="walkthrough-loop-step" key={number}>
          <span>{number}</span>
          <strong>{label}</strong>
          <p>{description}</p>
        </div>
      ))}
    </div>
  );
}

function PollutionPanel() {
  return (
    <div className="walkthrough-code-window">
      <div className="walkthrough-code-title">polluted.js</div>
      <pre>
        <span className="walkthrough-code-bad">- // TODO: refactor later</span>
        {"\n"}
        <span>  if (isReady) {"{"}</span>
        {"\n"}
        <span className="walkthrough-code-bad">-   value = value + 1</span>
        {"\n"}
        <span className="walkthrough-code-good">+   value += 1</span>
        {"\n"}
        <span className="walkthrough-code-bad">- {"}"}</span>
        {"\n"}
        <span>  return value</span>
      </pre>
    </div>
  );
}

function StepPanel({ panel }: { panel: WalkthroughStep["panel"] }) {
  if (panel === "welcome" || panel === "match") return <HeroEditorsPanel />;
  if (panel === "commands") return <CommandsPanel />;
  if (panel === "modes") return <ModesPanel />;
  if (panel === "loop") return <LoopPanel />;
  return <PollutionPanel />;
}

export default function Walkthrough() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { crtEnabled, toggleCrt } = useCRT();
  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isFinalStep = currentStep === STEPS.length - 1;
  const hasDuelPreview = step.panel === "welcome" || step.panel === "match";
  const progress = useMemo(
    () => ((currentStep + 1) / STEPS.length) * 100,
    [currentStep]
  );

  const goNext = useCallback(() => {
    if (isFinalStep) {
      navigate("/play");
      return;
    }
    setCurrentStep((stepIndex) => Math.min(stepIndex + 1, STEPS.length - 1));
  }, [isFinalStep, navigate]);

  const goPrevious = useCallback(() => {
    setCurrentStep((stepIndex) => Math.max(stepIndex - 1, 0));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName;

      if (tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        navigate("/");
      }
      if (event.key == "l") {
        event.preventDefault();
        goNext();
      }
      if (event.key == "h") {
        event.preventDefault();
        goPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrevious, navigate]);

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <section className="walkthrough-page" aria-labelledby="walkthrough-title">
        <div className="walkthrough-shell">
          <div className="walkthrough-topline">
            <span>guided_walkthrough.md</span>
            <button type="button" onClick={() => navigate("/")} aria-label="Exit walkthrough">
              :q
            </button>
          </div>

          <div className="walkthrough-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="walkthrough-step-meta">
            <span>
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span>{step.eyebrow}</span>
          </div>

          <div
            className={`walkthrough-content ${hasDuelPreview ? "walkthrough-content--duel" : ""}`}
            key={step.title}
          >
            <article className="walkthrough-copy">
              <p className="walkthrough-eyebrow">:{step.eyebrow.replaceAll(" ", "-")}</p>
              <h1 id="walkthrough-title">{step.title}</h1>
              <p className="walkthrough-summary">{step.summary}</p>
              <ul>
                {step.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>

            <aside className="walkthrough-panel" aria-label={`${step.title} preview`}>
              <StepPanel panel={step.panel} />
            </aside>
          </div>

          <div className="walkthrough-dots" aria-label="Walkthrough progress">
            {STEPS.map((item, index) => (
              <button
                type="button"
                key={item.title}
                className={index === currentStep ? "active" : ""}
                onClick={() => setCurrentStep(index)}
                aria-label={`Go to step ${index + 1}: ${item.title}`}
                aria-current={index === currentStep ? "step" : undefined}
              />
            ))}
          </div>

          <footer className="walkthrough-actions">
            <button
              type="button"
              className="walkthrough-button walkthrough-button--ghost"
              onClick={goPrevious}
              disabled={isFirstStep}
            >
              &lt; Previous
            </button>
            <div className="walkthrough-key-hint">Left / Right arrows navigate. Esc exits.</div>
            <div className="walkthrough-action-group">
              {isFinalStep && (
                <button
                  type="button"
                  className="walkthrough-button walkthrough-button--ghost"
                  onClick={() => navigate("/docs/vimtutor")}
                >
                  View VimTutor
                </button>
              )}
              <button type="button" className="walkthrough-button" onClick={goNext}>
                {isFinalStep ? "Start Playing" : step.nextLabel} &gt;
              </button>
            </div>
          </footer>
        </div>
      </section>
    </TerminalLayout>
  );
}
