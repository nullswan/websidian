import { useState, useEffect, useMemo, useCallback } from "react";

interface CalendarProps {
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function Calendar({ onSelectDate, onClose, anchorRect }: CalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [existingDates, setExistingDates] = useState<Set<string>>(new Set());

  // Fetch daily notes to know which days have notes
  useEffect(() => {
    fetch("/api/vault/tree", { credentials: "include" })
      .then((r) => r.json())
      .then((tree: { path: string }[]) => {
        const dates = new Set<string>();
        const findFiles = (items: any[]) => {
          for (const item of items) {
            if (item.children) findFiles(item.children);
            else if (item.path?.startsWith("Daily Notes/")) {
              const match = item.path.match(/(\d{4}-\d{2}-\d{2})\.md$/);
              if (match) dates.add(match[1]);
            }
          }
        };
        findFiles(Array.isArray(tree) ? tree : []);
        setExistingDates(dates);
      })
      .catch(() => {});
  }, []);

  const prevMonth = useCallback(() => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }, [month]);

  const goToday = useCallback(() => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }, [today]);

  const grid = useMemo(() => {
    const days = daysInMonth(year, month);
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    return cells;
  }, [year, month]);

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());

  // Position: to the right of the anchor button
  const left = anchorRect ? anchorRect.right + 8 : 60;
  const top = anchorRect ? Math.min(anchorRect.top, window.innerHeight - 340) : 200;

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 999 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          left,
          top,
          width: 240,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          padding: 12,
          zIndex: 1000,
          fontSize: 13,
          color: "var(--text-primary)",
          userSelect: "none",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button onClick={prevMonth} style={navBtn}>‹</button>
          <span
            style={{ fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            onClick={goToday}
            title="Go to today"
          >
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} style={navBtn}>›</button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, textAlign: "center", marginBottom: 4 }}>
          {dayHeaders.map((d) => (
            <div key={d} style={{ fontSize: 10, color: "var(--text-faint)", padding: 2, fontWeight: 600 }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, textAlign: "center" }}>
          {grid.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;
            const dateStr = fmtDate(year, month, day);
            const isToday = dateStr === todayStr;
            const hasNote = existingDates.has(dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => {
                  onSelectDate(dateStr);
                  onClose();
                }}
                style={{
                  width: 28,
                  height: 28,
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: isToday ? "1px solid var(--accent-color)" : "1px solid transparent",
                  borderRadius: "50%",
                  background: hasNote ? "rgba(127,109,242,0.2)" : "transparent",
                  color: hasNote ? "var(--accent-color)" : isToday ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: isToday || hasNote ? 600 : 400,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = hasNote ? "rgba(127,109,242,0.2)" : "transparent"; }}
                title={hasNote ? `Open ${dateStr}` : `Create ${dateStr}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "var(--text-faint)", justifyContent: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(127,109,242,0.3)", display: "inline-block" }} />
            Has note
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1px solid var(--accent-color)", display: "inline-block" }} />
            Today
          </span>
        </div>
      </div>
    </>
  );
}

const navBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  fontSize: 16,
  cursor: "pointer",
  padding: "2px 6px",
  borderRadius: 4,
};
