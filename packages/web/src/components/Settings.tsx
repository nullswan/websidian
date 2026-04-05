import { useState, useEffect } from "react";

export interface AppSettings {
  editorFontSize: number;
  readableLineLength: boolean;
  showLineNumbers: boolean;
  spellCheck: boolean;
  showInlineTitle: boolean;
  tabSize: number;
  templatesFolder: string;
  typewriterMode: boolean;
  focusMode: boolean;
  accentColor: string;
}

const DEFAULTS: AppSettings = {
  editorFontSize: 16,
  readableLineLength: true,
  showLineNumbers: false,
  spellCheck: false,
  showInlineTitle: true,
  tabSize: 4,
  templatesFolder: "Templates",
  typewriterMode: false,
  focusMode: false,
  accentColor: "#7f6df2",
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

export function Settings({ settings, onUpdate, onClose }: SettingsProps) {
  const [section, setSection] = useState<SettingsSection>("appearance");

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

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "appearance", label: "Appearance" },
    { id: "editor", label: "Editor" },
    { id: "about", label: "About" },
  ];

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
          background: "#1e1e1e",
          border: "1px solid #333",
          borderRadius: 8,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left nav */}
        <div
          style={{
            width: 180,
            borderRight: "1px solid #333",
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
              color: "#888",
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
                color: section === s.id ? "#c8bfff" : "#aaa",
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
            <h2 style={{ margin: 0, fontSize: 18, color: "#ddd", fontWeight: 600 }}>
              {sections.find((s) => s.id === section)?.label}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#888",
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
                      border: "1px solid #444",
                      borderRadius: 4,
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#888" }}>{settings.accentColor}</span>
                  {settings.accentColor !== "#7f6df2" && (
                    <button
                      onClick={() => update("accentColor", "#7f6df2")}
                      style={{
                        fontSize: 11,
                        color: "#888",
                        background: "transparent",
                        border: "1px solid #444",
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
                  style={{
                    width: 60,
                    padding: "4px 8px",
                    background: "#2a2a2a",
                    border: "1px solid #444",
                    borderRadius: 4,
                    color: "#ddd",
                    fontSize: 13,
                    textAlign: "center",
                  }}
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
                  style={{
                    padding: "4px 8px",
                    background: "#2a2a2a",
                    border: "1px solid #444",
                    borderRadius: 4,
                    color: "#ddd",
                    fontSize: 13,
                  }}
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
                title="Templates folder"
                description="Folder containing note templates"
              >
                <input
                  type="text"
                  value={settings.templatesFolder}
                  onChange={(e) => update("templatesFolder", e.target.value)}
                  style={{
                    width: 120,
                    padding: "4px 8px",
                    background: "#2a2a2a",
                    border: "1px solid #444",
                    borderRadius: 4,
                    color: "#ddd",
                    fontSize: 13,
                  }}
                />
              </SettingItem>
            </div>
          )}

          {section === "about" && (
            <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 12px" }}>
                <strong style={{ color: "#ddd" }}>Websidian</strong> — A web-native Obsidian-compatible client
              </p>
              <p style={{ margin: "0 0 8px" }}>
                Open-source project by <span style={{ color: "#7f6df2" }}>nullswan</span>
              </p>
              <p style={{ margin: "0 0 16px", fontSize: 12, color: "#666" }}>
                Built with React, CodeMirror 6, Fastify, and markdown-it
              </p>
              <div style={{ borderTop: "1px solid #333", paddingTop: 12, fontSize: 12, color: "#555" }}>
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #2a2a2a" }}>
      <div>
        <div style={{ fontSize: 14, color: "#ddd", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#777" }}>{description}</div>
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
        background: checked ? "#7f6df2" : "#444",
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
