import { useState, useEffect, useRef } from "react";
import { loadPlugins, unloadPlugins } from "../lib/plugin-sandbox.js";

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  isDesktopOnly: boolean;
  hasMain: boolean;
}

interface PluginStatus {
  status: "loaded" | "error" | "skipped";
  error?: string;
}

export function Plugins() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, PluginStatus>>({});
  const loadedRef = useRef<Awaited<ReturnType<typeof loadPlugins>>>([]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch("/api/vault/plugins", { credentials: "include" });
        const data = await res.json();
        const pluginList: PluginInfo[] = data.plugins ?? [];
        if (cancelled) return;
        setPlugins(pluginList);

        // Load web-compatible plugins in sandbox
        const results = await loadPlugins();
        if (cancelled) return;
        loadedRef.current = results;

        const statusMap: Record<string, PluginStatus> = {};
        for (const r of results) {
          statusMap[r.id] = { status: r.status, error: r.error };
        }
        setStatuses(statusMap);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      unloadPlugins(loadedRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 12, color: "#666", fontSize: 13 }}>
        Loading plugins...
      </div>
    );
  }

  if (plugins.length === 0) {
    return (
      <div style={{ padding: 12, color: "#555", fontSize: 13 }}>
        No plugins installed
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 4px", fontSize: 13 }}>
      {plugins.map((plugin) => {
        const st = statuses[plugin.id];
        return (
          <div
            key={plugin.id}
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid #2a2a2a",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: "#ddd" }}>
                {plugin.name}
              </span>
              <span style={{ fontSize: 11, color: "#666" }}>
                v{plugin.version}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              {plugin.description}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#666" }}>
                by {plugin.author}
              </span>
              {plugin.isDesktopOnly ? (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "#5a1d1d",
                    color: "#f88",
                  }}
                >
                  Desktop Only
                </span>
              ) : plugin.hasMain ? (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "rgba(127, 109, 242, 0.15)",
                    color: "#7f6df2",
                  }}
                >
                  Web Compatible
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "#333",
                    color: "#888",
                  }}
                >
                  No main.js
                </span>
              )}
              {st?.status === "loaded" && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "rgba(72, 199, 142, 0.15)",
                    color: "#48c78e",
                  }}
                >
                  Running
                </span>
              )}
              {st?.status === "error" && (
                <span
                  title={st.error}
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "#5a1d1d",
                    color: "#f88",
                  }}
                >
                  Error
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
