import { useMemo } from "react";

const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there",
  "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "time", "no",
  "just", "him", "know", "take", "people", "into", "year", "your",
  "good", "some", "could", "them", "see", "other", "than", "then",
  "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first",
  "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "is", "are", "was", "were", "been",
  "has", "had", "did", "does", "being", "am", "more", "very", "much",
  "such", "may", "should", "each", "own", "still", "those", "too",
  "where", "while", "need", "why", "here", "many", "through", "few",
]);

interface KeywordsProps {
  content: string;
  onSearch: (query: string) => void;
}

export function Keywords({ content, onSearch }: KeywordsProps) {
  const words = useMemo(() => {
    // Strip frontmatter
    const text = content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
    // Strip markdown syntax
    const clean = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/!\[\[.*?\]\]/g, "")
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
      .replace(/[#*_~=>\-|`\[\](){}]/g, " ")
      .replace(/https?:\/\/\S+/g, "");

    const freq = new Map<string, number>();
    for (const w of clean.toLowerCase().split(/\s+/)) {
      const word = w.replace(/[^a-z0-9'-]/g, "");
      if (word.length < 3 || STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }

    return [...freq.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [content]);

  if (words.length === 0) return <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "4px 0" }}>No keywords</div>;

  const maxCount = words[0][1];
  const minCount = words[words.length - 1][1];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", padding: "4px 0" }}>
      {words.map(([word, count]) => {
        const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
        const size = 10 + ratio * 5;
        const opacity = 0.5 + ratio * 0.5;
        return (
          <span
            key={word}
            onClick={() => onSearch(word)}
            title={`${word}: ${count} occurrences`}
            style={{
              fontSize: size,
              color: "var(--accent-color)",
              opacity,
              cursor: "pointer",
              transition: "opacity 0.15s",
              lineHeight: 1.4,
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = String(opacity); }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}
