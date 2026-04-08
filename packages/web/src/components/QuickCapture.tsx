import React, { useState, useEffect, useRef } from "react";

interface QuickCaptureProps {
  onClose: () => void;
  onSave: (path: string, content: string) => void;
}

export function QuickCapture({ onClose, onSave }: QuickCaptureProps) {
  const [captureText, setCaptureText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const save = () => {
    const text = captureText.trim();
    if (!text) return;
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const title = text.split("\n")[0].slice(0, 50).replace(/[/\\?%*:|"<>]/g, "").trim() || ts;
    const path = `Inbox/${title}.md`;
    onSave(path, text);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "20vh" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 500, maxWidth: "90vw", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Quick Capture</span>
          <span style={{ fontSize: 10, color: "var(--text-faint)" }}>Saves to Inbox/</span>
        </div>
        <textarea
          ref={inputRef}
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
            if (e.key === "Escape") onClose();
          }}
          placeholder="Type your note... (Cmd+Enter to save)"
          style={{ width: "100%", minHeight: 120, padding: "12px 16px", border: "none", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
        />
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "4px 12px", background: "none", border: "1px solid var(--border-color)", borderRadius: 4, color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>Cancel</button>
          <button onClick={save} disabled={!captureText.trim()} style={{ padding: "4px 12px", background: "var(--accent-color)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 12, opacity: captureText.trim() ? 1 : 0.5 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
