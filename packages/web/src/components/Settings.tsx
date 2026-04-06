import { useState, useEffect } from "react";

export interface AppSettings {
  theme: "dark" | "light";
  editorFontSize: number;
  readableLineLength: boolean;
  showLineNumbers: boolean;
  spellCheck: boolean;
  showInlineTitle: boolean;
  tabSize: number;
  templatesFolder: string;
  typewriterMode: boolean;
  focusMode: boolean;
  vimMode: boolean;
  accentColor: string;
  lineWrap: boolean;
}

const DEFAULTS: AppSettings = {
  theme: "dark",
  editorFontSize: 16,
  readableLineLength: true,
  showLineNumbers: false,
  spellCheck: false,
  showInlineTitle: true,
  tabSize: 4,
  templatesFolder: "Templates",
  typewriterMode: false,
  focusMode: false,
  vimMode: false,
  accentColor: "#7f6df2",
  lineWrap: true,
};

const STORAGE_KEY = "obsidian-web-settings";

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  onClose: () => void;
}

type SettingsSection = "appearance" | "editor" | "about";

interface VaultStats {
  totalNotes: number;
  totalAttachments: number;
  totalWords: number;
  totalSize: number;
  totalFiles: number;
}

export function Settings({ settings, onUpdate, onClose }: SettingsProps) {
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [stats, setStats] = useState<VaultStats | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value };
    onUpdate(next);
    saveSettings(next);
  };

  useEffect(() => {
    if (section === "about" && !stats) {
      fetch("/api/vault/stats", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => setStats(data))
        .catch(() => {});
    }
  }, [section, stats]);

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "appearance", label: "Appearance" },
    { id: "editor", label: "Editor" },
    { id: "about", label: "About" },
  ];

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 13,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 720,
          maxWidth: "90vw",
          height: 520,
          maxHeight: "80vh",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left nav */}
        <div
          style={{
            width: 180,
            borderRight: "1px solid var(--border-color)",
            padding: "16px 0",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            style={{
              padding: "4px 16px 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Settings
          </div>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                display: "block",
                width: "calc(100% - 16px)",
                marginLeft: 8,
                padding: "6px 12px",
                background: section === s.id ? "rgba(127,109,242,0.15)" : "transparent",
                color: section === s.id ? "var(--accent-color)" : "var(--text-secondary)",
                border: "none",
                borderRadius: 4,
                textAlign: "left",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "var(--text-primary)", fontWeight: 600 }}>
              {sections.find((s) => s.id === section)?.label}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 4,
              }}
            >
              ✕
            </button>
          </div>

          {section === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SettingItem
                title="Theme"
                description="Choose between light and dark appearance"
              >
                <select
                  value={settings.theme}
                  onChange={(e) => update("theme", e.target.value as "dark" | "light")}
                  style={inputStyle}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </SettingItem>

              <SettingItem
                title="Show inline title"
                description="Show the note filename as a heading above the content"
              >
                <Toggle checked={settings.showInlineTitle} onChange={(v) => update("showInlineTitle", v)} />
              </SettingItem>

              <SettingItem
                title="Readable line length"
                description="Limit the maximum line width for comfortable reading"
              >
                <Toggle checked={settings.readableLineLength} onChange={(v) => update("readableLineLength", v)} />
              </SettingItem>

              <SettingItem
                title="Accent color"
                description="Primary accent color used throughout the interface"
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => update("accentColor", e.target.value)}
                    style={{
                      width: 32,
                      height: 32,
                      border: "1px solid var(--border-color)",
                      borderRadius: 4,
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{settings.accentColor}</span>
                  {settings.accentColor !== "#7f6df2" && (
                    <button
                      onClick={() => update("accentColor", "#7f6df2")}
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        background: "transparent",
                        border: "1px solid var(--border-color)",
                        borderRadius: 3,
                        padding: "2px 6px",
                        cursor: "pointer",
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </SettingItem>
            </div>
          )}

          {section === "editor" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SettingItem
                title="Font size"
                description="Editor font size in pixels"
              >
                <input
                  type="number"
                  min={10}
                  max={32}
                  value={settings.editorFontSize}
                  onChange={(e) => update("editorFontSize", Number(e.target.value))}
                  style={{ ...inputStyle, width: 60, textAlign: "center" }}
                />
              </SettingItem>

              <SettingItem
                title="Show line numbers"
                description="Display line numbers in the editor gutter"
              >
                <Toggle checked={settings.showLineNumbers} onChange={(v) => update("showLineNumbers", v)} />
              </SettingItem>

              <SettingItem
                title="Spell check"
                description="Enable browser spell check in the editor"
              >
                <Toggle checked={settings.spellCheck} onChange={(v) => update("spellCheck", v)} />
              </SettingItem>

              <SettingItem
                title="Tab size"
                description="Number of spaces per tab"
              >
                <select
                  value={settings.tabSize}
                  onChange={(e) => update("tabSize", Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                </select>
              </SettingItem>

              <SettingItem
                title="Typewriter mode"
                description="Keep the active line centered in the editor while typing"
              >
                <Toggle checked={settings.typewriterMode} onChange={(v) => update("typewriterMode", v)} />
              </SettingItem>

              <SettingItem
                title="Focus mode"
                description="Dim inactive lines to focus on the current line"
              >
                <Toggle checked={settings.focusMode} onChange={(v) => update("focusMode", v)} />
              </SettingItem>

              <SettingItem
                title="Vim key bindings"
                description="Enable Vim modal editing (hjkl navigation, insert/normal mode)"
              >
                <Toggle checked={settings.vimMode} onChange={(v) => update("vimMode", v)} />
              </SettingItem>

              <SettingItem
                title="Line wrap"
                description="Wrap long lines in the editor instead of scrolling horizontally"
              >
                <Toggle checked={settings.lineWrap} onChange={(v) => update("lineWrap", v)} />
              </SettingItem>

              <SettingItem
                title="Templates folder"
                description="Folder containing note templates"
              >
                <input
                  type="text"
                  value={settings.templatesFolder}
                  onChange={(e) => update("templatesFolder", e.target.value)}
                  style={{ ...inputStyle, width: 120 }}
                />
              </SettingItem>
            </div>
          )}

          {section === "about" && (
            <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 12px" }}>
                <strong style={{ color: "var(--text-primary)" }}>Websidian</strong> — A web-native Obsidian-compatible client
              </p>
              <p style={{ margin: "0 0 8px" }}>
                Open-source project by <span style={{ color: "var(--accent-color)" }}>nullswan</span>
              </p>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-faint)" }}>
                Built with React, CodeMirror 6, Fastify, and markdown-it
              </p>
              {stats && (
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Vault Statistics</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                    <StatItem label="Notes" value={stats.totalNotes.toLocaleString()} />
                    <StatItem label="Attachments" value={stats.totalAttachments.toLocaleString()} />
                    <StatItem label="Total words" value={stats.totalWords.toLocaleString()} />
                    <StatItem label="Vault size" value={formatSize(stats.totalSize)} />
                  </div>
                </div>
              )}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12, fontSize: 12, color: "var(--text-faint)" }}>
                Keyboard shortcuts: Ctrl+/ &middot; Quick switcher: Ctrl+O &middot; Command palette: Ctrl+P
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingItem({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--bg-tertiary)" }}>
      <div>
        <div style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{description}</div>
      </div>
      <div style={{ marginLeft: 16, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: checked ? "var(--accent-color)" : "var(--border-color)",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          background: "#fff",
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
