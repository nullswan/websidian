import { useState, useEffect } from "react";

const STORAGE_KEY = "websidian-tour-dismissed";

interface TourStep {
  selector: string;
  title: string;
  description: string;
  position: "right" | "bottom" | "left" | "top";
}

const STEPS: TourStep[] = [
  {
    selector: '[title="File explorer"]',
    title: "File Explorer",
    description: "Browse and manage your vault files. Right-click for context menu actions.",
    position: "right",
  },
  {
    selector: '[title="Search"]',
    title: "Search",
    description: "Full-text search with regex support. Try Ctrl+Shift+F.",
    position: "right",
  },
  {
    selector: '[title="Graph view"]',
    title: "Graph View",
    description: "Visualize connections between notes. Alt+Click for path finder.",
    position: "right",
  },
  {
    selector: '[title*="Switch to"]',
    title: "Toggle Editor",
    description: "Switch between reading and Live Preview editing modes.",
    position: "bottom",
  },
  {
    selector: '[title="Settings"]',
    title: "Settings & More",
    description: "Customize theme, editor, and keybindings. Try Ctrl+Shift+P for the command palette.",
    position: "right",
  },
];

export function WelcomeTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Delay to let the UI render first
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible || step >= STEPS.length) return;
    const el = document.querySelector(STEPS[step].selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const s = STEPS[step];
      let top = rect.top;
      let left = rect.right + 12;
      if (s.position === "bottom") {
        top = rect.bottom + 12;
        left = rect.left;
      } else if (s.position === "left") {
        left = rect.left - 260;
      } else if (s.position === "top") {
        top = rect.top - 80;
        left = rect.left;
      }
      setPos({ top, left });
      // Pulse effect on target element
      el.classList.add("tour-highlight");
      return () => el.classList.remove("tour-highlight");
    }
    // If selector not found, skip to next step
    if (step < STEPS.length - 1) setStep(step + 1);
  }, [visible, step]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
    // Clean up any highlights
    document.querySelectorAll(".tour-highlight").forEach((el) => el.classList.remove("tour-highlight"));
  };

  const next = () => {
    document.querySelectorAll(".tour-highlight").forEach((el) => el.classList.remove("tour-highlight"));
    if (step >= STEPS.length - 1) {
      dismiss();
    } else {
      setStep(step + 1);
    }
  };

  if (!visible || step >= STEPS.length || !pos) return null;

  const currentStep = STEPS[step];

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 9998,
          cursor: "pointer",
        }}
      />
      {/* Tooltip */}
      <div
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          zIndex: 9999,
          background: "var(--bg-primary)",
          border: "1px solid var(--accent-color)",
          borderRadius: 8,
          padding: "12px 16px",
          maxWidth: 240,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "tour-fade-in 0.3s ease",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-color)", marginBottom: 4 }}>
          {currentStep.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
          {currentStep.description}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
            {step + 1} / {STEPS.length}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={dismiss}
              style={{
                background: "none",
                border: "1px solid var(--border-color)",
                color: "var(--text-muted)",
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Skip
            </button>
            <button
              onClick={next}
              style={{
                background: "var(--accent-color)",
                border: "none",
                color: "#fff",
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {step === STEPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
