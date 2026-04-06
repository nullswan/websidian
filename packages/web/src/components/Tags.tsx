import { useState, useEffect } from "react";

interface TagInfo {
  name: string;
  count: number;
  paths: string[];
}

interface TagsProps {
  onNavigate: (path: string) => void;
}

export function Tags({ onNavigate }: TagsProps) {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/vault/tags", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setTags(data.tags ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 12, color: "var(--text-faint)", fontSize: 13 }}>
        Loading tags...
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div style={{ padding: 12, color: "var(--text-faint)", fontSize: 13 }}>
        No tags found
      </div>
    );
  }

  // Build nested tag tree
  const tree = buildTagTree(tags);

  return (
    <div style={{ fontSize: 13, paddingBottom: 4 }}>
      {tree.map((node) => (
        <TagNode
          key={node.fullName}
          node={node}
          expandedTags={expandedTags}
          onToggle={(tag) => setExpandedTags((prev) => {
            const next = new Set(prev);
            if (next.has(tag)) next.delete(tag);
            else next.add(tag);
            return next;
          })}
          onNavigate={onNavigate}
          depth={0}
        />
      ))}
    </div>
  );
}

interface TagTreeNode {
  name: string;
  fullName: string;
  count: number;
  paths: string[];
  children: TagTreeNode[];
}

function buildTagTree(tags: TagInfo[]): TagTreeNode[] {
  const root: TagTreeNode[] = [];

  for (const tag of tags) {
    const parts = tag.name.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const partName = parts[i];
      const fullName = parts.slice(0, i + 1).join("/");
      let existing = current.find((n) => n.name === partName);

      if (!existing) {
        existing = {
          name: partName,
          fullName,
          count: 0,
          paths: [],
          children: [],
        };
        current.push(existing);
      }

      if (i === parts.length - 1) {
        existing.count = tag.count;
        existing.paths = tag.paths;
      }

      current = existing.children;
    }
  }

  return root;
}

function TagNode({
  node,
  expandedTags,
  onToggle,
  onNavigate,
  depth,
}: {
  node: TagTreeNode;
  expandedTags: Set<string>;
  onToggle: (tag: string) => void;
  onNavigate: (path: string) => void;
  depth: number;
}) {
  const isExpanded = expandedTags.has(node.fullName);
  const hasNotes = node.count > 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px 4px " + (8 + depth * 14) + "px",
          cursor: hasNotes || node.children.length > 0 ? "pointer" : "default",
          color: hasNotes ? "var(--accent-color)" : "var(--text-muted)",
        }}
        onClick={() => {
          if (hasNotes || node.children.length > 0) {
            onToggle(node.fullName);
          }
        }}
      >
        {(hasNotes || node.children.length > 0) && (
          <span style={{ fontSize: 10, width: 10 }}>
            {isExpanded ? "▼" : "▶"}
          </span>
        )}
        <span>#{node.name}</span>
        {hasNotes && (
          <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: "auto" }}>
            {node.count}
          </span>
        )}
      </div>

      {isExpanded && hasNotes && (
        <div style={{ paddingLeft: 8 + depth * 14 + 14 }}>
          {node.paths.map((path) => (
            <div
              key={path}
              style={{
                padding: "2px 8px",
                fontSize: 12,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              onClick={() => onNavigate(path)}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = "var(--text-secondary)";
              }}
            >
              {path.replace(/\.md$/, "")}
            </div>
          ))}
        </div>
      )}

      {node.children.length > 0 && (isExpanded || !hasNotes) && node.children.map((child) => (
        <TagNode
          key={child.fullName}
          node={child}
          expandedTags={expandedTags}
          onToggle={onToggle}
          onNavigate={onNavigate}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
