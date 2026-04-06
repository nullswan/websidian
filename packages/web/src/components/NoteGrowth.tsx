import { useMemo } from "react";
import { getSnapshots } from "./VersionHistory.js";

interface NoteGrowthProps {
  path: string;
}

export function NoteGrowth({ path }: NoteGrowthProps) {
  const data = useMemo(() => {
    const snaps = getSnapshots(path);
    if (snaps.length < 2) return null;
    // Reverse so oldest is first (snaps are newest-first)
    return snaps.map((s) => ({ words: s.words, ts: s.timestamp })).reverse();
  }, [path]);

  if (!data) return null;

  const words = data.map((d) => d.words);
  const min = Math.min(...words);
  const max = Math.max(...words);
  const range = max - min || 1;

  const width = 180;
  const height = 36;
  const padY = 2;

  const points = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = padY + (1 - (d.words - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Fill area under line
  const fillD = `${pathD} L${width},${height} L0,${height} Z`;

  const latest = data[data.length - 1];
  const oldest = data[0];
  const delta = latest.words - oldest.words;
  const deltaColor = delta > 0 ? "#4caf50" : delta < 0 ? "#f44336" : "var(--text-faint)";

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
          {formatDate(oldest.ts)} — {formatDate(latest.ts)}
        </span>
        <span style={{ fontSize: 11, color: deltaColor, fontWeight: 600 }}>
          {delta > 0 ? "+" : ""}{delta}w
        </span>
      </div>
      <svg width={width} height={height} style={{ display: "block", width: "100%" }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={fillD} fill="var(--accent-color)" opacity={0.1} />
        <path d={pathD} fill="none" stroke="var(--accent-color)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2}
            fill={i === points.length - 1 ? "var(--accent-color)" : "var(--bg-tertiary)"}
            stroke="var(--accent-color)"
            strokeWidth={1}
          >
            <title>{`${data[i].words} words — ${formatDate(data[i].ts)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
