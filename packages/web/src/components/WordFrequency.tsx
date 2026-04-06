import React, { useMemo } from "react";

const STOP_WORDS = new Set(["the","be","to","of","and","a","in","that","have","i","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","her","she","or","an","will","my","one","all","would","there","their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","no","just","him","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most","us"]);

interface WordFrequencyProps {
  content: string;
}

export const WordFrequency = React.memo(function WordFrequency({ content }: WordFrequencyProps) {
  const words = useMemo(() => {
    const text = content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "")
      .replace(/\[\[[^\]]+\]\]/g, "")
      .replace(/[#*_~`=\[\](){}|>]/g, " ")
      .toLowerCase();
    const counts: Record<string, number> = {};
    for (const w of text.split(/\s+/)) {
      const clean = w.replace(/[^a-z0-9'-]/g, "");
      if (clean.length < 3 || STOP_WORDS.has(clean)) continue;
      counts[clean] = (counts[clean] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [content]);

  if (words.length === 0) return <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--text-faint)" }}>No significant words</div>;

  const maxCount = words[0][1];
  return (
    <div style={{ padding: "4px 8px" }}>
      {words.map(([word, count]) => (
        <div key={word} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px", fontSize: 12 }}>
          <span style={{ flex: 1, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{word}</span>
          <div style={{ width: 60, height: 4, borderRadius: 2, background: "var(--bg-hover)", flexShrink: 0 }}>
            <div style={{ width: `${(count / maxCount) * 100}%`, height: "100%", borderRadius: 2, background: "var(--accent-color)", opacity: 0.6 }} />
          </div>
          <span style={{ fontSize: 10, color: "var(--text-faint)", width: 20, textAlign: "right", flexShrink: 0 }}>{count}</span>
        </div>
      ))}
    </div>
  );
});
