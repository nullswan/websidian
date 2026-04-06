import React, { useMemo } from "react";
import type { VaultEntry } from "../types.js";

interface OutgoingLinksProps {
  content: string;
  onNavigate: (path: string) => void;
  tree: VaultEntry[];
}

export const OutgoingLinks = React.memo(function OutgoingLinks({ content, onNavigate, tree }: OutgoingLinksProps) {
  const resolvedNames = useMemo(() => {
    const names = new Set<string>();
    const walk = (entries: VaultEntry[]) => {
      for (const e of entries) {
        if (e.kind === "file") {
          names.add(e.path);
          const base = e.path.replace(/\.[^.]+$/, "").split("/").pop()?.toLowerCase();
          if (base) names.add(base);
          names.add(e.path.replace(/\.[^.]+$/, "").toLowerCase());
        } else if (e.kind === "folder") {
          walk(e.children);
        }
      }
    };
    walk(tree);
    return names;
  }, [tree]);

  const links = useMemo(() => {
    const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
    const seen = new Set<string>();
    const result: Array<{ target: string; resolved: boolean }> = [];
    let m;
    while ((m = re.exec(content)) !== null) {
      const target = m[1].trim();
      if (!seen.has(target)) {
        seen.add(target);
        const t = target.toLowerCase();
        const resolved = resolvedNames.has(t) || resolvedNames.has(t + ".md") || resolvedNames.has(target);
        result.push({ target, resolved });
      }
    }
    return result;
  }, [content, resolvedNames]);

  if (links.length === 0) {
    return (
      <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--text-faint)" }}>
        No outgoing links
      </div>
    );
  }

  const resolved = links.filter((l) => l.resolved);
  const unresolved = links.filter((l) => !l.resolved);

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      {resolved.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>
            {resolved.length} resolved
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px" }}>
            {resolved.map(({ target }) => {
              const display = target.replace(/\.md$/, "").split("/").pop() ?? target;
              return (
                <li key={target} style={{ marginBottom: 4 }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(target);
                    }}
                    style={{
                      color: "var(--accent-color)",
                      textDecoration: "none",
                      fontSize: 13,
                    }}
                  >
                    {display}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {unresolved.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>
            {unresolved.length} unresolved
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {unresolved.map(({ target }) => {
              const display = target.replace(/\.md$/, "").split("/").pop() ?? target;
              return (
                <li key={target} style={{ marginBottom: 4 }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(target);
                    }}
                    style={{
                      color: "var(--text-faint)",
                      textDecoration: "none",
                      fontSize: 13,
                      opacity: 0.7,
                    }}
                  >
                    {display}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
});
