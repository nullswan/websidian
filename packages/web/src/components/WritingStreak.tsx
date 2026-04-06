import { useState, useEffect } from "react";

const STORAGE_KEY = "websidian-writing-streak";

interface StreakData {
  lastDate: string; // YYYY-MM-DD
  count: number;
  todayWords: number;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as StreakData;
      const today = todayStr();
      const yesterday = yesterdayStr();
      // If last activity was today, keep streak
      if (data.lastDate === today) return data;
      // If last activity was yesterday, streak continues but today's words reset
      if (data.lastDate === yesterday) return { ...data, todayWords: 0 };
      // Otherwise streak is broken
      return { lastDate: "", count: 0, todayWords: 0 };
    }
  } catch { /* ignore */ }
  return { lastDate: "", count: 0, todayWords: 0 };
}

function saveStreak(data: StreakData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const DAILY_LOG_KEY = "websidian-daily-words";

/** Call this when a note is saved to record writing activity */
export function recordWritingActivity(wordsWritten: number) {
  const streak = loadStreak();
  const today = todayStr();

  if (streak.lastDate === today) {
    // Already active today, just update word count
    streak.todayWords += wordsWritten;
    saveStreak(streak);
  } else {
    // New day — extend or start streak
    const yesterday = yesterdayStr();
    const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
    saveStreak({ lastDate: today, count: newCount, todayWords: wordsWritten });
  }

  // Update daily word log for heatmap
  try {
    const log: Record<string, number> = JSON.parse(localStorage.getItem(DAILY_LOG_KEY) ?? "{}");
    log[today] = (log[today] ?? 0) + wordsWritten;
    // Keep only last 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const key of Object.keys(log)) {
      if (key < cutoffStr) delete log[key];
    }
    localStorage.setItem(DAILY_LOG_KEY, JSON.stringify(log));
  } catch { /* ignore */ }
}

/** Get daily word counts for heatmap display */
export function getDailyWordLog(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DAILY_LOG_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function WritingStreak() {
  const [streak, setStreak] = useState(loadStreak);

  // Poll for streak updates (in case of saves from other tabs or components)
  useEffect(() => {
    const interval = setInterval(() => {
      setStreak(loadStreak());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Re-check on save events
  useEffect(() => {
    const handler = () => setStreak(loadStreak());
    window.addEventListener("websidian-save", handler);
    return () => window.removeEventListener("websidian-save", handler);
  }, []);

  const today = todayStr();
  const isActiveToday = streak.lastDate === today;
  const displayCount = isActiveToday ? streak.count : (streak.lastDate === yesterdayStr() ? streak.count : 0);

  if (displayCount === 0 && !isActiveToday) return null;

  const flameColor = displayCount >= 7 ? "#e6994a" : displayCount >= 3 ? "#e6c84a" : "var(--text-faint)";

  return (
    <span
      title={`Writing streak: ${displayCount} day${displayCount !== 1 ? "s" : ""}${isActiveToday ? ` · ${streak.todayWords} words today` : " · Write today to continue!"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        color: flameColor,
        cursor: "default",
        transition: "color 0.3s",
      }}
    >
      <svg width="11" height="13" viewBox="0 0 11 13" fill="none" style={{ flexShrink: 0 }}>
        <path
          d="M5.5 0C5.5 0 3 3 3 5.5C3 6.3 3.3 7 3.8 7.5C3.3 7.2 3 6.6 3 6C1.3 7 1 9.5 2.5 11C3.5 12 5 12.5 6.5 12C8.5 11.3 9.5 9 9 7C8.7 5.8 8 4.8 7 4C7 5.5 6.5 6.5 5.5 7C5.8 5.5 5.5 3 5.5 0Z"
          fill={isActiveToday ? flameColor : "none"}
          stroke={flameColor}
          strokeWidth="0.8"
          opacity={isActiveToday ? 1 : 0.5}
        />
      </svg>
      <span style={{ fontWeight: displayCount >= 3 ? 600 : 400 }}>
        {displayCount}
      </span>
    </span>
  );
}
