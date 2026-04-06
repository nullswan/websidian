import React from "react";
import { getHotkey, loadHotkeyOverrides } from "../lib/hotkeys.js";

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function kbd(shortcut: string): string {
  if (!isMac) return shortcut;
  return shortcut
    .replace(/Ctrl\+Shift\+/g, "⌃⇧")
    .replace(/Ctrl\+Alt\+/g, "⌃⌥")
    .replace(/Ctrl\+/g, "⌘")
    .replace(/Alt\+/g, "⌥")
    .replace(/Shift\+/g, "⇧");
}

interface ShortcutsOverlayProps {
  onClose: () => void;
}

const SHORTCUT_GROUPS = (hk: (id: string) => string): [string, string[][]][] => [
  ["Navigation", [
    [hk("quick-switcher"), "Quick switcher"],
    [hk("command-palette"), "Command palette"],
    [hk("toggle-mode"), "Toggle read/edit mode"],
    [hk("next-tab"), "Next tab"],
    [hk("prev-tab"), "Previous tab"],
    ["Ctrl+1-9", "Switch to Nth tab (9 = last)"],
    [hk("graph-view"), "Toggle graph view"],
  ]],
  ["Files", [
    [hk("new-note"), "New note"],
    [hk("daily-note"), "Open daily note"],
    [hk("close-tab"), "Close active tab"],
    [hk("undo-close-tab"), "Undo close tab"],
    ["Ctrl+Shift+N", "Extract selection to note"],
  ]],
  ["Editing", [
    ["Ctrl+D", "Select next occurrence"],
    ["Ctrl+F", "Find in editor"],
    ["Ctrl+H", "Find & replace"],
    ["Ctrl+B", "Bold"],
    ["Ctrl+I", "Italic"],
    ["Ctrl+K", "Insert link"],
    ["Ctrl+`", "Inline code"],
    ["Ctrl+Shift+X", "Strikethrough"],
    ["Ctrl+Enter", "Toggle list/task cycle"],
    ["Enter", "Continue list on new line"],
    ["Alt+↑/↓", "Move line up/down"],
    ["Alt+Shift+↑/↓", "Copy line up/down"],
    ["Ctrl+Shift+D", "Duplicate line/selection"],
    ["Ctrl+Shift+[", "Fold heading"],
    ["Ctrl+Shift+]", "Unfold heading"],
    ["[[", "Auto-close wikilink brackets"],
  ]],
  ["Interface", [
    [hk("toggle-left-sidebar"), "Toggle left sidebar"],
    [hk("toggle-right-sidebar"), "Toggle right sidebar"],
    [hk("search"), "Toggle search"],
    [hk("zen-mode"), "Toggle zen mode"],
    [hk("settings"), "Open settings"],
    [hk("shortcuts-help"), "Keyboard shortcuts"],
    [hk("split-right"), "Split editor right"],
    [hk("close-split"), "Close split pane"],
    [hk("focus-pane-1"), "Focus pane 1"],
    [hk("focus-pane-2"), "Focus pane 2"],
  ]],
];

export const ShortcutsOverlay = React.memo(function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  const hko = loadHotkeyOverrides();
  const hk = (id: string) => getHotkey(id, hko);
  const groups = SHORTCUT_GROUPS(hk);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          padding: "24px 32px",
          maxWidth: 480,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
          Keyboard Shortcuts
        </div>
        {groups.map(([group, shortcuts]) => (
          <div key={group}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 0 4px", marginTop: 4 }}>
              {group}
            </div>
            {shortcuts.map(([key, desc]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "5px 0",
                  borderBottom: "1px solid var(--bg-tertiary)",
                }}
              >
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{desc}</span>
                <kbd
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--text-faint)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 12,
                    color: "var(--text-primary)",
                    fontFamily: "system-ui, monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  {kbd(key)}
                </kbd>
              </div>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}>
          Press Escape or Ctrl+/ to close
        </div>
      </div>
    </div>
  );
});
