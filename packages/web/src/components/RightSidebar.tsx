import React from "react";
import { Properties } from "./Properties.js";
import { Backlinks } from "./Backlinks.js";
import { Outline } from "./Outline.js";
import { RelatedNotes } from "./RelatedNotes.js";
import { Tags } from "./Tags.js";
import { Keywords } from "./Keywords.js";
import { LocalGraph } from "./LocalGraph.js";
import { Snippets } from "./Snippets.js";
import { NoteGrowth } from "./NoteGrowth.js";
import { SidebarSection } from "./SidebarSection.js";
import { WordFrequency } from "./WordFrequency.js";
import { OutgoingLinks } from "./OutgoingLinks.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { updateFrontmatterField, deleteFrontmatterField, addFrontmatterField } from "../lib/frontmatter.js";
import type { Tab, BacklinkEntry, UnlinkedMention } from "../lib/appTypes.js";
import type { VaultEntry } from "../types.js";

interface RightSidebarProps {
  activeTab: Tab | null;
  isMarkdown: boolean;
  rightWidth: number;
  rightCollapsed: boolean;
  isMobile: boolean;
  headingNumbers: boolean;
  onRightResize: (delta: number) => void;
  onOpenTab: (path: string) => void;
  onNavigate: (target: string) => void;
  onSave: (content: string) => void;
  onUpdateTab: (id: string, patch: Partial<Tab>) => void;
  onShowToast: (msg: string) => void;
  onSetLeftPanel: (panel: "search") => void;
  onSetLeftCollapsed: (collapsed: boolean) => void;
  onSetSearchQuery: (query: string) => void;
  scrollToHeadingRef: React.MutableRefObject<((heading: string, level: number) => void) | null>;
  tree: VaultEntry[];
}

export const RightSidebar = React.memo(function RightSidebar({
  activeTab,
  isMarkdown,
  rightWidth,
  rightCollapsed,
  isMobile,
  headingNumbers,
  onRightResize,
  onOpenTab,
  onNavigate,
  onSave,
  onUpdateTab,
  onShowToast,
  onSetLeftPanel,
  onSetLeftCollapsed,
  onSetSearchQuery,
  scrollToHeadingRef,
  tree,
}: RightSidebarProps) {
  return (
    <aside
      style={{
        width: isMobile || rightCollapsed || !activeTab || !isMarkdown ? 0 : rightWidth,
        minWidth: isMobile || rightCollapsed || !activeTab || !isMarkdown ? 0 : 140,
        borderLeft: isMobile || rightCollapsed || !activeTab || !isMarkdown ? "none" : "1px solid var(--border-color)",
        background: "var(--bg-secondary)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        transition: "width 0.2s ease, min-width 0.2s ease",
      }}
    >
      {activeTab && isMarkdown && activeTab.content != null && (
        <>
          <ResizeHandle side="right" onResize={onRightResize} />
          <ErrorBoundary>
          {(activeTab.noteMeta || activeTab.fileCreated) && (
            <SidebarSection title="Properties">
              <Properties
                frontmatter={activeTab.noteMeta?.frontmatter ?? {}}
                fileCreated={activeTab.fileCreated}
                fileModified={activeTab.fileModified}
                fileSize={activeTab.fileSize}
                content={activeTab.content}
                onUpdate={(key, value) => {
                  if (!activeTab) return;
                  const updated = updateFrontmatterField(activeTab.content, key, value);
                  onUpdateTab(activeTab.id, { content: updated });
                  onSave(updated);
                }}
                onDelete={(key) => {
                  if (!activeTab) return;
                  const updated = deleteFrontmatterField(activeTab.content, key);
                  onUpdateTab(activeTab.id, { content: updated });
                  onSave(updated);
                }}
                onAdd={(key, value) => {
                  if (!activeTab) return;
                  const updated = addFrontmatterField(activeTab.content, key, value);
                  onUpdateTab(activeTab.id, { content: updated });
                  onSave(updated);
                }}
              />
            </SidebarSection>
          )}
          <SidebarSection title="Note Growth">
            <NoteGrowth path={activeTab.path} />
          </SidebarSection>
          <SidebarSection title="File Info">
            <FileInfoPanel activeTab={activeTab} />
          </SidebarSection>
          <SidebarSection title="Backlinks" badge={activeTab.backlinks.length}>
            <Backlinks
              backlinks={activeTab.backlinks}
              onNavigate={onOpenTab}
            />
          </SidebarSection>
          <SidebarSection title="Unlinked Mentions" badge={activeTab.unlinkedMentions.length}>
            <UnlinkedMentionsPanel
              activeTab={activeTab}
              onOpenTab={onOpenTab}
              onUpdateTab={onUpdateTab}
              onShowToast={onShowToast}
            />
          </SidebarSection>
          <SidebarSection title="Outgoing Links" badge={countOutgoingLinks(activeTab.content)}>
            <ErrorBoundary><OutgoingLinks content={activeTab.content} onNavigate={onNavigate} tree={tree} /></ErrorBoundary>
          </SidebarSection>
          <SidebarSection title="Local Graph">
            <ErrorBoundary><LocalGraph
              currentPath={activeTab.path}
              outgoingLinks={getOutgoingLinkPaths(activeTab.content)}
              backlinkPaths={activeTab.backlinks.map((bl) => bl.path)}
              onNavigate={(path) => onOpenTab(path)}
            /></ErrorBoundary>
          </SidebarSection>
          <SidebarSection title="Related Notes">
            <ErrorBoundary><RelatedNotes currentPath={activeTab.path} onNavigate={onOpenTab} /></ErrorBoundary>
          </SidebarSection>
          <SidebarSection title="Word Frequency">
            <ErrorBoundary><WordFrequency content={activeTab.content} /></ErrorBoundary>
          </SidebarSection>
          <SidebarSection title="Outline">
            <ErrorBoundary><Outline
              content={activeTab.content}
              showNumbers={headingNumbers}
              noteTitle={activeTab.path.replace(/\.md$/, "").split("/").pop() || ""}
              onScrollToHeading={(heading, level) => scrollToHeadingRef.current?.(heading, level)}
              onReorderSection={(fromLine, fromLevel, toLine) => {
                if (!activeTab) return;
                const lines = activeTab.content.split("\n");
                let sectionEnd = lines.length;
                for (let i = fromLine; i < lines.length; i++) {
                  const m = /^(#{1,6})\s/.exec(lines[i]);
                  if (m && m[1].length <= fromLevel) { sectionEnd = i; break; }
                }
                const section = lines.slice(fromLine - 1, sectionEnd);
                const remaining = [...lines.slice(0, fromLine - 1), ...lines.slice(sectionEnd)];
                let insertAt = toLine - 1;
                if (toLine > fromLine) insertAt -= section.length;
                insertAt = Math.max(0, Math.min(insertAt, remaining.length));
                remaining.splice(insertAt, 0, ...section);
                const newContent = remaining.join("\n");
                onUpdateTab(activeTab.id, { content: newContent, dirty: true });
                fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ content: newContent }),
                }).catch(() => {});
              }}
            /></ErrorBoundary>
          </SidebarSection>
          <SidebarSection title="Keywords">
            <ErrorBoundary><Keywords
              content={activeTab?.content ?? ""}
              onSearch={(query) => {
                onSetLeftPanel("search");
                onSetLeftCollapsed(false);
                onSetSearchQuery(query);
              }}
            /></ErrorBoundary>
          </SidebarSection>
          <SidebarSection title="Tags">
            <ErrorBoundary><Tags onNavigate={onOpenTab} /></ErrorBoundary>
          </SidebarSection>
          <SidebarSection title="CSS Snippets">
            <ErrorBoundary><Snippets /></ErrorBoundary>
          </SidebarSection>
          </ErrorBoundary>
        </>
      )}
    </aside>
  );
});

function countOutgoingLinks(content: string): number {
  const re = /\[\[([^\]|#]+)/g;
  const links = new Set<string>();
  let m;
  while ((m = re.exec(content)) !== null) links.add(m[1].trim());
  return links.size;
}

function getOutgoingLinkPaths(content: string): string[] {
  const re = /\[\[([^\]|#]+)/g;
  const links: string[] = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    const target = m[1].trim();
    const path = target.endsWith(".md") ? target : `${target}.md`;
    links.push(path);
  }
  return [...new Set(links)];
}

// File Info sub-component
const FileInfoPanel = React.memo(function FileInfoPanel({ activeTab }: { activeTab: Tab }) {
  const text = activeTab.content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  const links = (activeTab.content.match(/\[\[[^\]]+\]\]/g) ?? []).length;
  const items: [string, string][] = [
    ["Words", words.toLocaleString()],
    ["Characters", chars.toLocaleString()],
    ["Links", String(links)],
    ["Backlinks", String(activeTab.backlinks.length)],
  ];
  if (activeTab.fileSize != null) {
    const sz = activeTab.fileSize;
    items.push(["Size", sz < 1024 ? `${sz} B` : sz < 1048576 ? `${(sz / 1024).toFixed(1)} KB` : `${(sz / 1048576).toFixed(1)} MB`]);
  }
  if (activeTab.fileCreated) items.push(["Created", new Date(activeTab.fileCreated).toLocaleDateString()]);
  if (activeTab.fileModified) items.push(["Modified", new Date(activeTab.fileModified).toLocaleDateString()]);

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
  const wordList = text.trim().split(/\s+/).filter(Boolean);
  const syllableCount = (w: string) => {
    const word = w.toLowerCase().replace(/[^a-z]/g, "");
    if (word.length <= 3) return 1;
    const count = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
      .replace(/^y/, "")
      .match(/[aeiouy]{1,2}/g)?.length ?? 1;
    return Math.max(1, count);
  };
  const totalSyllables = wordList.reduce((s, w) => s + syllableCount(w), 0);
  const flesch = words >= 10
    ? Math.round(206.835 - 1.015 * (words / sentences) - 84.6 * (totalSyllables / words))
    : null;
  const fleschLabel = flesch === null ? null
    : flesch >= 80 ? "Easy" : flesch >= 60 ? "Standard" : flesch >= 40 ? "Moderate" : "Complex";
  const fleschColor = flesch === null ? "var(--text-faint)"
    : flesch >= 80 ? "var(--color-green)" : flesch >= 60 ? "var(--color-yellow)" : flesch >= 40 ? "var(--color-orange)" : "var(--color-red)";

  return (
    <div style={{ padding: "4px 12px 8px", fontSize: 12, color: "var(--text-secondary)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 12px" }}>
        {items.map(([label, val]) => (
          <React.Fragment key={label}>
            <span style={{ color: "var(--text-faint)" }}>{label}</span>
            <span style={{ color: "var(--text-primary)", textAlign: "right" }}>{val}</span>
          </React.Fragment>
        ))}
      </div>
      {flesch !== null && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }} title={`Flesch Reading Ease: ${flesch}/100`}>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Readability</span>
          <div style={{ flex: 1, height: 6, background: "var(--bg-tertiary)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(0, Math.min(100, flesch))}%`, height: "100%", background: fleschColor, borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 10, color: fleschColor, fontWeight: 600, minWidth: 50, textAlign: "right" }}>{fleschLabel}</span>
        </div>
      )}
    </div>
  );
});

// Unlinked Mentions sub-component
const UnlinkedMentionsPanel = React.memo(function UnlinkedMentionsPanel({
  activeTab,
  onOpenTab,
  onUpdateTab,
  onShowToast,
}: {
  activeTab: Tab;
  onOpenTab: (path: string) => void;
  onUpdateTab: (id: string, patch: Partial<Tab>) => void;
  onShowToast: (msg: string) => void;
}) {
  if (activeTab.unlinkedMentions.length === 0) {
    return <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--text-faint)" }}>No unlinked mentions</div>;
  }

  const grouped = new Map<string, Array<{ line: number; lineContext: string }>>();
  for (const m of activeTab.unlinkedMentions) {
    if (!grouped.has(m.path)) grouped.set(m.path, []);
    grouped.get(m.path)!.push({ line: m.line, lineContext: m.lineContext });
  }

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {[...grouped.entries()].map(([path, mentions]) => (
          <li key={path} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onOpenTab(path); }}
                title={path}
                style={{ color: "var(--accent-color)", textDecoration: "none", fontSize: 13, flex: 1 }}
              >
                {path.replace(/\.md$/, "").split("/").pop()}
              </a>
              <button
                title="Link all mentions in this note"
                onClick={async () => {
                  const basename = activeTab.path.replace(/\.md$/, "").split("/").pop() ?? "";
                  const res = await fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, { credentials: "include" });
                  const data = await res.json();
                  if (data.error) return;
                  const re = new RegExp(`(?<!\\[\\[)\\b(${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?!\\]\\])`, "gi");
                  const newContent = data.content.replace(re, "[[" + basename + "]]");
                  if (newContent !== data.content) {
                    await fetch("/api/vault/file", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ path, content: newContent }),
                    });
                    fetch(`/api/vault/backlinks?path=${encodeURIComponent(activeTab.path)}`)
                      .then((r) => r.json())
                      .then((d) => { if (!d.error) onUpdateTab(activeTab.id, { backlinks: d.backlinks, unlinkedMentions: d.unlinkedMentions ?? [] }); });
                    onShowToast(`Linked mentions in ${path.replace(/\.md$/, "").split("/").pop()}`);
                  }
                }}
                style={{
                  background: "transparent", border: "1px solid var(--border-color)", borderRadius: 3,
                  color: "var(--accent-color)", fontSize: 10, padding: "1px 5px", cursor: "pointer",
                  lineHeight: 1.4, flexShrink: 0,
                }}
              >
                Link
              </button>
            </div>
            {mentions.slice(0, 3).map((m, i) => (
              <div key={i} style={{
                fontSize: 11, color: "var(--text-secondary)", marginTop: 2,
                padding: "2px 0 2px 8px", borderLeft: "2px solid var(--border-color)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                cursor: "pointer",
              }} onClick={() => onOpenTab(path)}>
                {m.lineContext}
              </div>
            ))}
            {mentions.length > 3 && (
              <div style={{ fontSize: 10, color: "var(--text-faint)", paddingLeft: 8, marginTop: 2 }}>
                +{mentions.length - 3} more
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
});
