import { useState, useEffect, useMemo } from "react";
import { createMarkdownRenderer } from "../lib/markdown.js";

interface SharePageProps {
  shareId: string;
}

export function SharePage({ shareId }: SharePageProps) {
  const [note, setNote] = useState<{ name: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const md = useMemo(() => createMarkdownRenderer(), []);

  useEffect(() => {
    async function tryInlineDecode() {
      try {
        const b64 = shareId.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

        try {
          const blob = new Blob([bytes]);
          const ds = blob.stream().pipeThrough(new DecompressionStream("gzip"));
          const text = await new Response(ds).text();
          const data = JSON.parse(text);
          if (data.t && data.c !== undefined) {
            setNote({ name: data.t, content: data.c });
            return;
          }
        } catch {
          try {
            const text = decodeURIComponent(escape(binary));
            const data = JSON.parse(text);
            if (data.t && data.c !== undefined) {
              setNote({ name: data.t, content: data.c });
              return;
            }
          } catch { /* not inline encoded */ }
        }
      } catch { /* not base64 */ }

      fetch(`/share/${shareId}`)
        .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
        .then((data) => setNote(data))
        .catch(() => setError("Shared note not found or link expired"));
    }

    tryInlineDecode();
  }, [shareId]);

  if (error) return <div style={{ padding: 48, color: "#f88", fontSize: 18 }}>{error}</div>;
  if (!note) return <div style={{ padding: 48, color: "var(--text-faint)" }}>Loading...</div>;

  const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(note.content);
  const body = fmMatch ? note.content.slice(fmMatch[0].length) : note.content;
  const html = md.render(body);

  return (
    <div style={{ maxWidth: 750, margin: "0 auto", padding: "32px 48px" }}>
      <h1 style={{ fontSize: "2em", marginBottom: 8, color: "var(--heading-color)" }}>{note.name}</h1>
      <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 24 }}>Shared from Websidian</div>
      <div className="reader-view" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
