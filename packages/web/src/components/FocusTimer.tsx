import { useState, useEffect, useRef, useCallback } from "react";

const DURATIONS = [25, 15, 5, 50]; // minutes
const STORAGE_KEY = "websidian-focus-timer";

interface TimerState {
  running: boolean;
  duration: number; // total seconds
  remaining: number; // seconds
  startedAt: number; // Date.now()
}

function loadState(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as TimerState;
    if (!s.running) return null;
    // Compute remaining based on elapsed time
    const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
    const remaining = s.duration - elapsed;
    if (remaining <= 0) return null;
    return { ...s, remaining };
  } catch {
    return null;
  }
}

function saveState(s: TimerState | null) {
  if (!s) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FocusTimer() {
  const [timer, setTimer] = useState<TimerState | null>(loadState);
  const [showMenu, setShowMenu] = useState(false);
  const [flash, setFlash] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  const tick = useCallback(() => {
    setTimer((prev) => {
      if (!prev || !prev.running) return prev;
      const next = prev.remaining - 1;
      if (next <= 0) {
        saveState(null);
        setFlash(true);
        setTimeout(() => setFlash(false), 3000);
        return null;
      }
      return { ...prev, remaining: next };
    });
  }, []);

  useEffect(() => {
    if (timer?.running) {
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer?.running, tick]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const start = (minutes: number) => {
    const state: TimerState = {
      running: true,
      duration: minutes * 60,
      remaining: minutes * 60,
      startedAt: Date.now(),
    };
    setTimer(state);
    saveState(state);
    setShowMenu(false);
  };

  const stop = () => {
    setTimer(null);
    saveState(null);
    setShowMenu(false);
  };

  if (flash) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "var(--color-green)",
          fontWeight: 600,
          animation: "save-pulse 1s ease-in-out 3",
        }}
      >
        Focus complete!
      </span>
    );
  }

  if (!timer) {
    return (
      <span style={{ position: "relative" }} ref={menuRef}>
        <span
          onClick={() => setShowMenu((v) => !v)}
          style={{
            cursor: "pointer",
            color: "var(--text-faint)",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent-color)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
          title="Start focus timer"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4v4.5l3 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Focus
        </span>
        {showMenu && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              marginBottom: 6,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              padding: 4,
              zIndex: 1000,
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              minWidth: 120,
            }}
          >
            {DURATIONS.map((d) => (
              <div
                key={d}
                onClick={() => start(d)}
                style={{
                  padding: "5px 10px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  borderRadius: 4,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(127,109,242,0.12)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {d} min
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  const pct = 1 - timer.remaining / timer.duration;
  const r = 5;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const isLow = timer.remaining <= 60;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        color: isLow ? "var(--color-orange)" : "var(--accent-color)",
        fontWeight: 500,
        animation: isLow ? "save-pulse 1s ease-in-out infinite" : undefined,
      }}
      onClick={stop}
      title="Click to cancel timer"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle cx="7" cy="7" r={r} fill="none" stroke="var(--border-color)" strokeWidth="1.5" />
        <circle
          cx="7" cy="7" r={r}
          fill="none"
          stroke={isLow ? "var(--color-orange)" : "var(--accent-color)"}
          strokeWidth="1.5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      {formatTime(timer.remaining)}
    </span>
  );
}
