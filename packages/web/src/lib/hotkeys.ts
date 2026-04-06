// Hotkey customization system
// Action IDs map to keyboard shortcuts; users can override defaults.

export interface HotkeyDef {
  id: string;
  name: string;
  defaultKey: string; // e.g. "Ctrl+N", "Ctrl+Shift+F"
}

// Canonical list of all remappable actions
export const HOTKEY_ACTIONS: HotkeyDef[] = [
  { id: "new-note", name: "Create new note", defaultKey: "Ctrl+N" },
  { id: "daily-note", name: "Open daily note", defaultKey: "Ctrl+D" },
  { id: "quick-switcher", name: "Quick switcher", defaultKey: "Ctrl+O" },
  { id: "search", name: "Search in files", defaultKey: "Ctrl+Shift+F" },
  { id: "toggle-mode", name: "Toggle edit/read mode", defaultKey: "Ctrl+E" },
  { id: "command-palette", name: "Command palette", defaultKey: "Ctrl+P" },
  { id: "graph-view", name: "Toggle graph view", defaultKey: "Ctrl+G" },
  { id: "close-tab", name: "Close current tab", defaultKey: "Ctrl+W" },
  { id: "shortcuts-help", name: "Show keyboard shortcuts", defaultKey: "Ctrl+/" },
  { id: "toggle-left-sidebar", name: "Toggle left sidebar", defaultKey: "Ctrl+\\" },
  { id: "toggle-right-sidebar", name: "Toggle right sidebar", defaultKey: "Ctrl+Shift+\\" },
  { id: "zen-mode", name: "Toggle zen mode", defaultKey: "Ctrl+Shift+Z" },
  { id: "settings", name: "Open settings", defaultKey: "Ctrl+," },
  { id: "undo-close-tab", name: "Undo close tab", defaultKey: "Ctrl+Shift+T" },
  { id: "next-tab", name: "Next tab", defaultKey: "Ctrl+Tab" },
  { id: "prev-tab", name: "Previous tab", defaultKey: "Ctrl+Shift+Tab" },
  { id: "navigate-back", name: "Navigate back", defaultKey: "Alt+ArrowLeft" },
  { id: "navigate-forward", name: "Navigate forward", defaultKey: "Alt+ArrowRight" },
  { id: "split-right", name: "Split editor right", defaultKey: "Ctrl+Alt+\\" },
  { id: "close-split", name: "Close split pane", defaultKey: "Ctrl+Alt+W" },
  { id: "focus-pane-1", name: "Focus pane 1", defaultKey: "Ctrl+Alt+1" },
  { id: "focus-pane-2", name: "Focus pane 2", defaultKey: "Ctrl+Alt+2" },
];

const STORAGE_KEY = "obsidian-web-hotkeys";

export type HotkeyOverrides = Record<string, string>; // actionId → key combo

export function loadHotkeyOverrides(): HotkeyOverrides {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

export function saveHotkeyOverrides(overrides: HotkeyOverrides) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

/** Get the effective key combo for an action (override or default) */
export function getHotkey(actionId: string, overrides: HotkeyOverrides): string {
  return overrides[actionId] ?? HOTKEY_ACTIONS.find((a) => a.id === actionId)?.defaultKey ?? "";
}

/** Build a reverse map: key combo → action ID for fast lookup during keydown */
export function buildHotkeyMap(overrides: HotkeyOverrides): Map<string, string> {
  const map = new Map<string, string>();
  for (const action of HOTKEY_ACTIONS) {
    const key = overrides[action.id] ?? action.defaultKey;
    if (key) map.set(key, action.id);
  }
  return map;
}

/** Convert a KeyboardEvent to our canonical string format */
export function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  let key = e.key;
  // Normalize modifier-only presses
  if (["Control", "Meta", "Alt", "Shift"].includes(key)) return "";
  // Normalize key names
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join("+");
}

/** Check if a KeyboardEvent matches a hotkey combo string */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  if (!combo) return false;
  const parts = combo.split("+");
  const needCtrl = parts.includes("Ctrl");
  const needAlt = parts.includes("Alt");
  const needShift = parts.includes("Shift");
  const keyPart = parts.filter((p) => !["Ctrl", "Alt", "Shift"].includes(p))[0];

  if (!keyPart) return false;
  if (needCtrl !== (e.ctrlKey || e.metaKey)) return false;
  if (needAlt !== e.altKey) return false;
  if (needShift !== e.shiftKey) return false;

  // Compare key
  let eventKey = e.key;
  if (eventKey === " ") eventKey = "Space";

  // Case-insensitive single char comparison
  if (keyPart.length === 1 && eventKey.length === 1) {
    return keyPart.toLowerCase() === eventKey.toLowerCase();
  }
  return keyPart === eventKey;
}
