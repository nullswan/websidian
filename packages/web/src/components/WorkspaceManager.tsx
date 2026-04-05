import { useState, useEffect, useRef } from "react";

interface WorkspaceSnapshot {
  tabs: Array<{ id: string; path: string; mode: string }>;
  panes: Array<{ tabIds: string[]; activeTabId: string | null }>;
  activePaneIdx: number;
  leftPanel: string;
  leftWidth: number;
  rightWidth: number;
  splitRatio: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

interface SavedWorkspace {
  name: string;
  snapshot: WorkspaceSnapshot;
  savedAt: number;
}

const STORAGE_KEY = "obsidian-web-workspaces";

function loadWorkspaces(): SavedWorkspace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWorkspaces(workspaces: SavedWorkspace[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
}

interface WorkspaceManagerProps {
  onClose: () => void;
  onLoad: (snapshot: WorkspaceSnapshot) => void;
  getCurrentSnapshot: () => WorkspaceSnapshot;
  showToast: (msg: string) => void;
}

export function WorkspaceManager({ onClose, onLoad, getCurrentSnapshot, showToast }: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<SavedWorkspace[]>(loadWorkspaces);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    const name = newName.trim();
    if (!name) return;
    const snapshot = getCurrentSnapshot();
    const updated = workspaces.filter((w) => w.name !== name);
    updated.push({ name, snapshot, savedAt: Date.now() });
    updated.sort((a, b) => a.name.localeCompare(b.name));
    saveWorkspaces(updated);
    setWorkspaces(updated);
    setNewName("");
    showToast(`Workspace "${name}" saved`);
  };

  const handleLoad = (ws: SavedWorkspace) => {
    onLoad(ws.snapshot);
    onClose();
    showToast(`Loaded workspace "${ws.name}"`);
  };

  const handleDelete = (name: string) => {
    const updated = workspaces.filter((w) => w.name !== name);
    saveWorkspaces(updated);
    setWorkspaces(updated);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh" }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e1e1e",
          border: "1px solid #444",
          borderRadius: 8,
          width: 400,
          maxHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #333" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#ddd", marginBottom: 8 }}>Workspaces</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") onClose();
              }}
              placeholder="Workspace name..."
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid #444",
                borderRadius: 4,
                background: "#2a2a2a",
                color: "#ddd",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={handleSave}
              disabled={!newName.trim()}
              style={{
                padding: "6px 12px",
                border: "1px solid rgba(127,109,242,0.4)",
                borderRadius: 4,
                background: "rgba(127,109,242,0.15)",
                color: newName.trim() ? "#7f6df2" : "#555",
                fontSize: 13,
                cursor: newName.trim() ? "pointer" : "default",
              }}
            >
              Save
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {workspaces.length === 0 ? (
            <div style={{ padding: 16, color: "#555", fontSize: 13, textAlign: "center" }}>
              No saved workspaces
            </div>
          ) : (
            workspaces.map((ws) => (
              <div
                key={ws.name}
                style={{
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "1px solid #2a2a2a",
                  cursor: "pointer",
                }}
                onClick={() => handleLoad(ws)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(127,109,242,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#ddd", fontSize: 13 }}>{ws.name}</div>
                  <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>
                    {ws.snapshot.tabs.length} tab{ws.snapshot.tabs.length !== 1 ? "s" : ""} · {new Date(ws.savedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(ws.name); }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#555",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "2px 6px",
                  }}
                  title="Delete workspace"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
