import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { VaultEntry } from "../types.js";

type SortMode = "name" | "mtime";

const SORT_KEY = "filetree-sort";

function loadSortMode(): SortMode {
  try {
    const v = localStorage.getItem(SORT_KEY);
    if (v === "name" || v === "mtime") return v;
  } catch {}
  return "name";
}

function sortEntries(entries: VaultEntry[], mode: SortMode = "name"): VaultEntry[] {
  return [...entries].sort((a, b) => {
    const aDir = a.kind === "folder" ? 0 : 1;
    const bDir = b.kind === "folder" ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    if (mode === "mtime" && a.kind === "file" && b.kind === "file") {
      return (b.mtime ?? 0) - (a.mtime ?? 0);
    }
    const aName = (a.path.split("/").pop() ?? a.path).toLowerCase();
    const bName = (b.path.split("/").pop() ?? b.path).toLowerCase();
    return aName.localeCompare(bName);
  });
}

// Inline SVG icons for file tree
const ChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 1.5 L7 5 L3 8.5" />
  </svg>
);

const ChevronDown = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M1.5 3 L5 7 L8.5 3" />
  </svg>
);

const FolderIcon = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
    {open ? (
      <path d="M1.5 3.5 h4.5 l1.5 1.5 h6 v1 h-10 l-1.5 6.5 h10.5 l1.5-6.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    ) : (
      <path d="M1.5 3 h4.5 l1.5 1.5 h6.5 v8.5 h-12.5 z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    )}
  </svg>
);

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  let color = "var(--text-muted)";
  if (ext === "md") color = "var(--accent-color)";
  else if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) color = "#4ec9b0";
  else if (ext === "canvas") color = "#e6994a";

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 1.5 h6.5 l3.5 3.5 v9.5 h-10 z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <path d="M9.5 1.5 v3.5 h3.5" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

interface FileTreeProps {
  entries: VaultEntry[];
  onFileSelect: (path: string) => void;
  selectedPath: string | null;
  onMutate?: () => void;
  onFileRenamed?: (from: string, to: string, updatedFiles: string[]) => void;
  onDuplicate?: (path: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  entry: VaultEntry | null;
  parentPath: string;
}

function filterTree(entries: VaultEntry[], query: string): VaultEntry[] {
  const q = query.toLowerCase();
  return entries.reduce<VaultEntry[]>((acc, entry) => {
    const name = (entry.path.split("/").pop() ?? "").toLowerCase();
    if (entry.kind === "folder") {
      const filtered = filterTree(entry.children, query);
      if (filtered.length > 0 || name.includes(q)) {
        acc.push({ ...entry, children: filtered.length > 0 ? filtered : entry.children });
      }
    } else if (name.includes(q)) {
      acc.push(entry);
    }
    return acc;
  }, []);
}

const EXPANDED_KEY = "filetree-expanded";

function countFiles(entry: VaultEntry): number {
  if (entry.kind === "file") return 1;
  return entry.children.reduce((sum, child) => sum + countFiles(child), 0);
}

function collectFolderPaths(entries: VaultEntry[]): string[] {
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.kind === "folder") {
      paths.push(entry.path);
      paths.push(...collectFolderPaths(entry.children));
    }
  }
  return paths;
}

function loadExpandedPaths(): Set<string> | null {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch { return null; }
}

function saveExpandedPaths(paths: Set<string>) {
  try { localStorage.setItem(EXPANDED_KEY, JSON.stringify([...paths])); } catch {}
}

function flattenVisible(entries: VaultEntry[], expandedPaths: Set<string>, sortMode: SortMode): string[] {
  const result: string[] = [];
  for (const entry of sortEntries(entries, sortMode)) {
    result.push(entry.path);
    if (entry.kind === "folder" && expandedPaths.has(entry.path)) {
      result.push(...flattenVisible(entry.children, expandedPaths, sortMode));
    }
  }
  return result;
}

export function FileTree({ entries, onFileSelect, selectedPath, onMutate, onFileRenamed, onDuplicate }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; kind: "file" | "folder" } | null>(null);
  const [filter, setFilter] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const saved = loadExpandedPaths();
    // Default: all folders expanded on first visit
    return saved ?? new Set(collectFolderPaths(entries));
  });

  const [sortMode, setSortMode] = useState<SortMode>(loadSortMode);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const treeRef = useRef<HTMLUListElement>(null);

  const handleDrop = async (sourcePath: string, targetFolder: string) => {
    setDropTarget(null);
    const name = sourcePath.split("/").pop()!;
    const newPath = targetFolder ? `${targetFolder}/${name}` : name;
    if (newPath === sourcePath) return;
    // Don't allow dropping a folder into itself or a descendant
    if (sourcePath === targetFolder || targetFolder.startsWith(sourcePath + "/")) return;
    const res = await fetch("/api/vault/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ from: sourcePath, to: newPath }),
    });
    if (res.ok) {
      const data = await res.json();
      onFileRenamed?.(sourcePath, newPath, data.updatedFiles ?? []);
    }
    onMutate?.();
  };

  const toggleExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      saveExpandedPaths(next);
      return next;
    });
  };

  // Auto-reveal: expand parent folders when selected path changes
  useEffect(() => {
    if (!selectedPath || !selectedPath.includes("/")) return;
    const parts = selectedPath.split("/");
    let changed = false;
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (let i = 1; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join("/");
        if (!next.has(parentPath)) {
          next.add(parentPath);
          changed = true;
        }
      }
      if (!changed) return prev;
      saveExpandedPaths(next);
      return next;
    });
  }, [selectedPath]);

  const filteredEntries = useMemo(
    () => filter.trim() ? filterTree(entries, filter.trim()) : entries,
    [entries, filter],
  );

  const flatPaths = useMemo(
    () => flattenVisible(filteredEntries, expandedPaths, sortMode),
    [filteredEntries, expandedPaths, sortMode],
  );

  // Find entry by path in the tree
  const findEntry = useCallback((path: string, entries: VaultEntry[]): VaultEntry | null => {
    for (const e of entries) {
      if (e.path === path) return e;
      if (e.kind === "folder" && e.children) {
        const found = findEntry(path, e.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!flatPaths.length) return;
    const currentIdx = focusedPath ? flatPaths.indexOf(focusedPath) : -1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = Math.min(currentIdx + 1, flatPaths.length - 1);
      setFocusedPath(flatPaths[nextIdx]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextIdx = Math.max(currentIdx - 1, 0);
      setFocusedPath(flatPaths[nextIdx]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!focusedPath) return;
      const entry = findEntry(focusedPath, entries);
      if (!entry) return;
      if (entry.kind === "folder") {
        toggleExpanded(entry.path);
      } else {
        onFileSelect(entry.path);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!focusedPath) return;
      const entry = findEntry(focusedPath, entries);
      if (entry?.kind === "folder" && !expandedPaths.has(entry.path)) {
        toggleExpanded(entry.path);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (!focusedPath) return;
      const entry = findEntry(focusedPath, entries);
      if (entry?.kind === "folder" && expandedPaths.has(entry.path)) {
        toggleExpanded(entry.path);
      } else if (focusedPath.includes("/")) {
        // Move to parent folder
        const parentPath = focusedPath.split("/").slice(0, -1).join("/");
        setFocusedPath(parentPath);
      }
    }
  }, [flatPaths, focusedPath, entries, expandedPaths, toggleExpanded, onFileSelect, findEntry]);

  const closeMenu = () => setContextMenu(null);

  const handleContextMenu = (e: React.MouseEvent, entry: VaultEntry | null, parentPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry, parentPath });
  };

  const handleDelete = async (path: string) => {
    closeMenu();
    if (!confirm(`Delete "${path}"?`)) return;
    await fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
      credentials: "include",
    });
    onMutate?.();
  };

  const handleRename = (path: string) => {
    closeMenu();
    setRenaming(path);
  };

  const handleRenameSubmit = async (oldPath: string, newName: string) => {
    setRenaming(null);
    if (!newName.trim()) return;
    const parts = oldPath.split("/");
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");
    if (newPath === oldPath) return;
    const res = await fetch("/api/vault/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ from: oldPath, to: newPath }),
    });
    if (res.ok) {
      const data = await res.json();
      onFileRenamed?.(oldPath, newPath, data.updatedFiles ?? []);
    }
    onMutate?.();
  };

  const handleCreate = (parentPath: string, kind: "file" | "folder") => {
    closeMenu();
    setCreating({ parentPath, kind });
  };

  const handleCreateSubmit = async (name: string) => {
    if (!creating || !name.trim()) {
      setCreating(null);
      return;
    }
    const parent = creating.parentPath;
    const fullPath = parent ? `${parent}/${name}` : name;
    if (creating.kind === "file") {
      const path = fullPath.endsWith(".md") ? fullPath : `${fullPath}.md`;
      await fetch("/api/vault/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path, content: "" }),
      });
      onMutate?.();
      onFileSelect(path);
    } else {
      // Create folder by creating a placeholder file then deleting it
      // Or just create a file inside the folder
      const placeholder = `${fullPath}/.gitkeep`;
      await fetch("/api/vault/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path: placeholder, content: "" }),
      });
      onMutate?.();
    }
    setCreating(null);
  };

  return (
    <>
      <div style={{ padding: "4px 8px 4px", display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files..."
          style={{
            flex: 1,
            minWidth: 0,
            padding: "4px 8px",
            border: "1px solid transparent",
            borderRadius: 4,
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-color)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
        />
        <button
          title={sortMode === "name" ? "Sort by name (click for modified)" : "Sort by modified (click for name)"}
          onClick={() => {
            const next: SortMode = sortMode === "name" ? "mtime" : "name";
            setSortMode(next);
            localStorage.setItem(SORT_KEY, next);
          }}
          style={{
            background: "none",
            border: "none",
            color: sortMode === "mtime" ? "var(--accent-color)" : "var(--text-faint)",
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            {sortMode === "name" ? (
              <>
                <path d="M2 4h12M2 8h8M2 12h4" />
              </>
            ) : (
              <>
                <path d="M2 4h4M2 8h8M2 12h12" />
              </>
            )}
          </svg>
        </button>
      </div>
      <ul
        ref={treeRef}
        tabIndex={0}
        style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, outline: "none" }}
        onKeyDown={handleTreeKeyDown}
        onContextMenu={(e) => handleContextMenu(e, null, "")}
        onDragOver={(e) => { e.preventDefault(); setDropTarget("__root__"); }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => {
          e.preventDefault();
          const src = e.dataTransfer.getData("text/plain");
          if (src) handleDrop(src, "");
        }}
      >
        {sortEntries(filteredEntries, sortMode).map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            onFileSelect={onFileSelect}
            selectedPath={selectedPath}
            focusedPath={focusedPath}
            depth={0}
            onContextMenu={handleContextMenu}
            renaming={renaming}
            onRenameSubmit={handleRenameSubmit}
            creating={creating}
            onCreateSubmit={handleCreateSubmit}
            expandedPaths={expandedPaths}
            toggleExpanded={toggleExpanded}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            onDrop={handleDrop}
            sortMode={sortMode}
          />
        ))}
        {creating && creating.parentPath === "" && (
          <li>
            <InlineInput
              defaultValue={creating.kind === "file" ? "Untitled.md" : "New Folder"}
              onSubmit={handleCreateSubmit}
              onCancel={() => setCreating(null)}
              depth={1}
            />
          </li>
        )}
      </ul>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onClose={closeMenu}
          onDelete={handleDelete}
          onRename={handleRename}
          onCreate={handleCreate}
          onDuplicate={onDuplicate}
          parentPath={contextMenu.parentPath}
        />
      )}
    </>
  );
}

function FileTreeNode({
  entry,
  onFileSelect,
  selectedPath,
  focusedPath,
  depth,
  onContextMenu,
  renaming,
  onRenameSubmit,
  creating,
  onCreateSubmit,
  expandedPaths,
  toggleExpanded,
  dropTarget,
  setDropTarget,
  onDrop,
  sortMode,
}: {
  entry: VaultEntry;
  onFileSelect: (path: string) => void;
  selectedPath: string | null;
  focusedPath: string | null;
  depth: number;
  onContextMenu: (e: React.MouseEvent, entry: VaultEntry | null, parentPath: string) => void;
  renaming: string | null;
  onRenameSubmit: (oldPath: string, newName: string) => void;
  creating: { parentPath: string; kind: "file" | "folder" } | null;
  onCreateSubmit: (name: string) => void;
  expandedPaths: Set<string>;
  toggleExpanded: (path: string) => void;
  dropTarget: string | null;
  setDropTarget: (path: string | null) => void;
  onDrop: (sourcePath: string, targetFolder: string) => void;
  sortMode: SortMode;
}) {
  if (entry.kind === "folder") {
    const expanded = expandedPaths.has(entry.path);
    const isDragOver = dropTarget === entry.path;
    const isFocused = focusedPath === entry.path;
    return (
      <li>
        <div
          ref={(el) => { if (el && isFocused) el.scrollIntoView({ block: "nearest" }); }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", entry.path);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropTarget(entry.path);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (dropTarget === entry.path) setDropTarget(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const src = e.dataTransfer.getData("text/plain");
            if (src) onDrop(src, entry.path);
          }}
          style={{
            paddingLeft: depth * 16 + 4,
            padding: "3px 8px 3px " + (depth * 16 + 4) + "px",
            cursor: "pointer",
            color: isFocused ? "var(--text-primary)" : "var(--text-secondary)",
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            gap: 5,
            borderRadius: 3,
            margin: "0 4px",
            transition: "background 0.1s",
            background: isDragOver ? "rgba(127,109,242,0.15)" : isFocused ? "rgba(127,109,242,0.1)" : "transparent",
            outline: isDragOver ? "1px solid rgba(127,109,242,0.4)" : isFocused ? "1px solid rgba(127,109,242,0.3)" : "none",
          }}
          onClick={() => toggleExpanded(entry.path)}
          onContextMenu={(e) => onContextMenu(e, entry, entry.path)}
          onMouseEnter={(e) => { if (!isDragOver) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={(e) => { if (!isDragOver) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span style={{ display: "flex", alignItems: "center", width: 10 }}>
            {expanded ? <ChevronDown /> : <ChevronRight />}
          </span>
          <FolderIcon open={expanded} />
          <span style={{ fontSize: 13, flex: 1 }}>{entry.path.split("/").pop()}</span>
          <span style={{ fontSize: 10, color: "var(--text-faint)", flexShrink: 0 }}>{countFiles(entry)}</span>
        </div>
        {expanded && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {sortEntries(entry.children, sortMode).map((child) => (
              <FileTreeNode
                key={child.path}
                entry={child}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
                focusedPath={focusedPath}
                depth={depth + 1}
                onContextMenu={onContextMenu}
                renaming={renaming}
                onRenameSubmit={onRenameSubmit}
                creating={creating}
                onCreateSubmit={onCreateSubmit}
                expandedPaths={expandedPaths}
                toggleExpanded={toggleExpanded}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                onDrop={onDrop}
                sortMode={sortMode}
              />
            ))}
            {creating && creating.parentPath === entry.path && (
              <li>
                <InlineInput
                  defaultValue={creating.kind === "file" ? "Untitled.md" : "New Folder"}
                  onSubmit={onCreateSubmit}
                  onCancel={() => onCreateSubmit("")}
                  depth={depth + 2}
                />
              </li>
            )}
          </ul>
        )}
      </li>
    );
  }

  const isSelected = entry.path === selectedPath;
  const isFocused = focusedPath === entry.path;
  const name = entry.path.split("/").pop() ?? entry.path;
  const isRenaming = renaming === entry.path;

  return (
    <li>
      {isRenaming ? (
        <InlineInput
          defaultValue={name}
          onSubmit={(newName) => onRenameSubmit(entry.path, newName)}
          onCancel={() => onRenameSubmit(entry.path, name)}
          depth={depth + 1}
        />
      ) : (
        <div
          ref={(el) => {
            if (el && (isSelected || isFocused)) {
              el.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
          }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", entry.path);
            e.dataTransfer.effectAllowed = "move";
          }}
          style={{
            paddingLeft: depth * 16 + 18,
            padding: "3px 8px 3px " + (depth * 16 + 18) + "px",
            cursor: "pointer",
            background: isSelected ? "var(--bg-hover)" : isFocused ? "rgba(127,109,242,0.1)" : "transparent",
            color: isSelected ? "var(--text-primary)" : isFocused ? "var(--text-primary)" : "var(--text-secondary)",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            gap: 5,
            margin: "0 4px",
            transition: "background 0.1s",
            fontSize: 13,
            outline: isFocused && !isSelected ? "1px solid rgba(127,109,242,0.3)" : "none",
          }}
          onClick={() => onFileSelect(entry.path)}
          onContextMenu={(e) => {
            const parentPath = entry.path.includes("/")
              ? entry.path.split("/").slice(0, -1).join("/")
              : "";
            onContextMenu(e, entry, parentPath);
          }}
          onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <FileIcon name={name} />
          <span>{name}</span>
        </div>
      )}
    </li>
  );
}

function InlineInput({
  defaultValue,
  onSubmit,
  onCancel,
  depth,
}: {
  defaultValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  depth: number;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      // Select filename without extension
      const dotIdx = defaultValue.lastIndexOf(".");
      ref.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : defaultValue.length);
    }
  }, []);

  return (
    <input
      ref={ref}
      defaultValue={defaultValue}
      style={{
        marginLeft: depth * 16,
        width: `calc(100% - ${depth * 16 + 8}px)`,
        background: "var(--bg-tertiary)",
        border: "1px solid var(--accent-color)",
        borderRadius: 3,
        color: "var(--text-primary)",
        fontSize: 13,
        padding: "2px 4px",
        outline: "none",
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit(e.currentTarget.value);
        if (e.key === "Escape") onCancel();
      }}
      onBlur={(e) => onSubmit(e.currentTarget.value)}
    />
  );
}

function ContextMenu({
  x,
  y,
  entry,
  onClose,
  onDelete,
  onRename,
  onCreate,
  onDuplicate,
  parentPath,
}: {
  x: number;
  y: number;
  entry: VaultEntry | null;
  onClose: () => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
  onCreate: (parentPath: string, kind: "file" | "folder") => void;
  onDuplicate?: (path: string) => void;
  parentPath: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const isFolder = entry?.kind === "folder";
  const folderPath = isFolder ? entry.path : parentPath;

  const menuItems: Array<{ label: string; action: () => void; danger?: boolean }> = [];

  menuItems.push({ label: "New Note", action: () => onCreate(folderPath, "file") });
  menuItems.push({ label: "New Folder", action: () => onCreate(folderPath, "folder") });

  if (entry) {
    menuItems.push({ label: "Rename", action: () => onRename(entry.path) });
    if (entry.kind !== "folder" && onDuplicate) {
      menuItems.push({ label: "Duplicate", action: () => { onClose(); onDuplicate(entry.path); } });
    }
    if (entry.kind !== "folder") {
      menuItems.push({ label: "Delete", action: () => onDelete(entry.path), danger: true });
    }
  }

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border-color)",
        borderRadius: 4,
        padding: "4px 0",
        zIndex: 1000,
        minWidth: 140,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      {menuItems.map((item, i) => (
        <div
          key={i}
          onClick={item.action}
          style={{
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 13,
            color: item.danger ? "#f88" : "var(--text-primary)",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = "transparent";
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
