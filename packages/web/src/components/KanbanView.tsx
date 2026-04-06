import { useState, useMemo, useCallback } from "react";

interface KanbanCard {
  text: string;
  checked?: boolean;
}

interface KanbanColumn {
  heading: string;
  cards: KanbanCard[];
}

interface KanbanViewProps {
  content: string;
  onSave: (newContent: string) => void;
  onNavigate?: (path: string) => void;
}

function parseKanban(content: string): { frontmatter: string; columns: KanbanColumn[] } {
  let body = content;
  let frontmatter = "";
  const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(content);
  if (fmMatch) {
    frontmatter = fmMatch[0];
    body = content.slice(fmMatch[0].length);
  }

  const columns: KanbanColumn[] = [];
  let current: KanbanColumn | null = null;

  for (const line of body.split("\n")) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      current = { heading: headingMatch[1].trim(), cards: [] };
      columns.push(current);
      continue;
    }
    if (!current) continue;

    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      current.cards.push({ text: taskMatch[2].trim(), checked: taskMatch[1] !== " " });
      continue;
    }
    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch) {
      current.cards.push({ text: itemMatch[1].trim() });
    }
  }

  return { frontmatter, columns };
}

function serializeKanban(frontmatter: string, columns: KanbanColumn[]): string {
  const parts: string[] = [];
  if (frontmatter) parts.push(frontmatter);
  for (const col of columns) {
    parts.push(`## ${col.heading}\n`);
    for (const card of col.cards) {
      if (card.checked !== undefined) {
        parts.push(`- [${card.checked ? "x" : " "}] ${card.text}`);
      } else {
        parts.push(`- ${card.text}`);
      }
    }
    parts.push("");
  }
  return parts.join("\n").trimEnd() + "\n";
}

export function KanbanView({ content, onSave, onNavigate }: KanbanViewProps) {
  const { frontmatter, columns: initialColumns } = useMemo(() => parseKanban(content), [content]);
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns);
  const [dragSource, setDragSource] = useState<{ colIdx: number; cardIdx: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ colIdx: number; cardIdx: number } | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);

  // Sync when content changes externally
  useMemo(() => {
    setColumns(parseKanban(content).columns);
  }, [content]);

  const save = useCallback((cols: KanbanColumn[]) => {
    setColumns(cols);
    onSave(serializeKanban(frontmatter, cols));
  }, [frontmatter, onSave]);

  const moveCard = useCallback((fromCol: number, fromCard: number, toCol: number, toCard: number) => {
    const next = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const [card] = next[fromCol].cards.splice(fromCard, 1);
    next[toCol].cards.splice(toCard, 0, card);
    save(next);
  }, [columns, save]);

  const toggleCard = useCallback((colIdx: number, cardIdx: number) => {
    const next = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    const card = next[colIdx].cards[cardIdx];
    if (card.checked !== undefined) {
      next[colIdx].cards[cardIdx] = { ...card, checked: !card.checked };
      save(next);
    }
  }, [columns, save]);

  const addCard = useCallback((colIdx: number, text: string) => {
    if (!text.trim()) return;
    const next = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    next[colIdx].cards.push({ text: text.trim() });
    save(next);
    setAddingTo(null);
  }, [columns, save]);

  const removeCard = useCallback((colIdx: number, cardIdx: number) => {
    const next = columns.map((c) => ({ ...c, cards: [...c.cards] }));
    next[colIdx].cards.splice(cardIdx, 1);
    save(next);
  }, [columns, save]);

  if (columns.length === 0) {
    return (
      <div style={{ padding: 24, color: "var(--text-faint)", fontSize: 13, textAlign: "center" }}>
        <p>No kanban columns found.</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Add <code>## Column Name</code> headings with <code>- [ ] task</code> items to use kanban view.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "16px 12px",
      overflowX: "auto",
      height: "100%",
      alignItems: "flex-start",
    }}>
      {columns.map((col, colIdx) => (
        <div
          key={colIdx}
          style={{
            minWidth: 240,
            maxWidth: 300,
            background: "var(--bg-secondary)",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (col.cards.length === 0) setDropTarget({ colIdx, cardIdx: 0 });
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragSource && col.cards.length === 0) {
              moveCard(dragSource.colIdx, dragSource.cardIdx, colIdx, 0);
            }
            setDragSource(null);
            setDropTarget(null);
          }}
        >
          {/* Column header */}
          <div style={{
            padding: "10px 12px 6px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--border-color)",
          }}>
            <span>{col.heading}</span>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400 }}>{col.cards.length}</span>
          </div>

          {/* Cards */}
          <div style={{ padding: "6px 8px", flex: 1, minHeight: 40 }}>
            {col.cards.map((card, cardIdx) => {
              const isDragOver = dropTarget?.colIdx === colIdx && dropTarget?.cardIdx === cardIdx;
              const isDragging = dragSource?.colIdx === colIdx && dragSource?.cardIdx === cardIdx;
              return (
                <div
                  key={cardIdx}
                  draggable
                  onDragStart={(e) => {
                    setDragSource({ colIdx, cardIdx });
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropTarget({ colIdx, cardIdx });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragSource) {
                      moveCard(dragSource.colIdx, dragSource.cardIdx, colIdx, cardIdx);
                    }
                    setDragSource(null);
                    setDropTarget(null);
                  }}
                  onDragEnd={() => { setDragSource(null); setDropTarget(null); }}
                  style={{
                    padding: "8px 10px",
                    marginBottom: 4,
                    background: "var(--bg-primary)",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    cursor: "grab",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    opacity: isDragging ? 0.4 : 1,
                    borderTop: isDragOver ? "2px solid var(--accent-color)" : "2px solid transparent",
                    transition: "opacity 0.15s",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  {card.checked !== undefined && (
                    <input
                      type="checkbox"
                      checked={card.checked}
                      onChange={() => toggleCard(colIdx, cardIdx)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: 2, accentColor: "var(--accent-color)", cursor: "pointer", flexShrink: 0 }}
                    />
                  )}
                  <span
                    style={{
                      flex: 1,
                      textDecoration: card.checked ? "line-through" : "none",
                      opacity: card.checked ? 0.5 : 1,
                    }}
                    onClick={() => {
                      // Navigate if card text looks like a wikilink
                      const wikiMatch = card.text.match(/^\[\[([^\]]+)\]\]$/);
                      if (wikiMatch && onNavigate) {
                        const target = wikiMatch[1].split("|")[0];
                        onNavigate(target.endsWith(".md") ? target : target + ".md");
                      }
                    }}
                  >
                    {card.text.replace(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/, (_, p, alias) => alias || p)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCard(colIdx, cardIdx); }}
                    title="Remove card"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-faint)",
                      cursor: "pointer",
                      padding: "0 2px",
                      fontSize: 12,
                      opacity: 0,
                      transition: "opacity 0.15s",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add card */}
          <div style={{ padding: "4px 8px 8px" }}>
            {addingTo === colIdx ? (
              <input
                autoFocus
                placeholder="Card text..."
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  border: "1px solid var(--accent-color)",
                  borderRadius: 4,
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { addCard(colIdx, e.currentTarget.value); }
                  if (e.key === "Escape") setAddingTo(null);
                }}
                onBlur={(e) => {
                  if (e.currentTarget.value.trim()) addCard(colIdx, e.currentTarget.value);
                  else setAddingTo(null);
                }}
              />
            ) : (
              <button
                onClick={() => setAddingTo(colIdx)}
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  border: "1px dashed var(--border-color)",
                  borderRadius: 4,
                  background: "transparent",
                  color: "var(--text-faint)",
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-color)"; e.currentTarget.style.color = "var(--accent-color)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.color = "var(--text-faint)"; }}
              >
                + Add card
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
