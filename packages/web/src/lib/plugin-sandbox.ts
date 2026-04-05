/**
 * Browser-safe plugin sandbox for Obsidian-compatible plugins.
 *
 * Loads plugin main.js in a controlled scope with a mock `obsidian` module API.
 * Only web-compatible (non-desktop-only) plugins with main.js are loaded.
 */

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  isDesktopOnly: boolean;
  hasMain: boolean;
}

interface LoadedPlugin {
  id: string;
  name: string;
  instance: PluginInstance | null;
  status: "loaded" | "error" | "skipped";
  error?: string;
}

interface PluginInstance {
  onload?: () => void;
  onunload?: () => void;
}

// Minimal mock of the obsidian module API — just enough for plugins to load
function createObsidianMock() {
  class Notice {
    message: string;
    constructor(message: string, timeout?: number) {
      this.message = message;
      console.log(`[Plugin Notice] ${message}`);
    }
  }

  class Plugin {
    app: Record<string, unknown> = {};
    manifest: Record<string, unknown> = {};
    onload() {}
    onunload() {}
    addCommand() { return this; }
    addRibbonIcon() { return document.createElement("div"); }
    addStatusBarItem() { return document.createElement("div"); }
    addSettingTab() {}
    registerEvent() {}
    registerInterval(id: number) { return id; }
    registerDomEvent() {}
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
  }

  class PluginSettingTab {
    app: Record<string, unknown> = {};
    plugin: unknown;
    containerEl = document.createElement("div");
    constructor(app: unknown, plugin: unknown) {
      this.plugin = plugin;
    }
    display() {}
    hide() {}
  }

  class Setting {
    settingEl = document.createElement("div");
    constructor(_containerEl: HTMLElement) {}
    setName() { return this; }
    setDesc() { return this; }
    addText() { return this; }
    addToggle() { return this; }
    addDropdown() { return this; }
    addSlider() { return this; }
    addButton() { return this; }
    addTextArea() { return this; }
  }

  class Modal {
    app: unknown;
    contentEl = document.createElement("div");
    modalEl = document.createElement("div");
    titleEl = document.createElement("div");
    constructor(app: unknown) { this.app = app; }
    open() {}
    close() {}
    onOpen() {}
    onClose() {}
  }

  class MarkdownView {
    getViewType() { return "markdown"; }
  }

  return {
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    Modal,
    MarkdownView,
    // Commonly referenced but not critical
    TFile: class {},
    TFolder: class {},
    TAbstractFile: class {},
    normalizePath: (p: string) => p,
    Platform: { isDesktop: false, isMobile: false, isDesktopApp: false },
  };
}

/**
 * Execute plugin source in a sandboxed scope with a mock `require("obsidian")`.
 */
function executePluginSource(source: string, pluginId: string): PluginInstance | null {
  const obsidianMock = createObsidianMock();

  const mockRequire = (mod: string) => {
    if (mod === "obsidian") return obsidianMock;
    console.warn(`[Plugin:${pluginId}] Unsupported require("${mod}")`);
    return {};
  };

  const moduleObj = { exports: {} as Record<string, unknown> };

  try {
    const wrappedFn = new Function(
      "module",
      "exports",
      "require",
      source,
    );
    wrappedFn(moduleObj, moduleObj.exports, mockRequire);

    // Plugin class is usually module.exports or module.exports.default
    const PluginClass =
      (moduleObj.exports as any).default ?? moduleObj.exports;

    if (typeof PluginClass === "function") {
      const instance = new PluginClass();
      return instance;
    }

    return null;
  } catch (err) {
    console.error(`[Plugin:${pluginId}] Execution error:`, err);
    throw err;
  }
}

/**
 * Fetch plugin list, load web-compatible ones, call onload().
 */
export async function loadPlugins(): Promise<LoadedPlugin[]> {
  const results: LoadedPlugin[] = [];

  try {
    const res = await fetch("/api/vault/plugins", { credentials: "include" });
    const data = await res.json();
    const plugins: PluginManifest[] = data.plugins ?? [];

    for (const plugin of plugins) {
      if (plugin.isDesktopOnly || !plugin.hasMain) {
        results.push({
          id: plugin.id,
          name: plugin.name,
          instance: null,
          status: "skipped",
        });
        continue;
      }

      try {
        const srcRes = await fetch(
          `/api/vault/plugin-source?id=${encodeURIComponent(plugin.id)}`,
          { credentials: "include" },
        );
        if (!srcRes.ok) {
          results.push({
            id: plugin.id,
            name: plugin.name,
            instance: null,
            status: "error",
            error: `HTTP ${srcRes.status}`,
          });
          continue;
        }

        const { source } = await srcRes.json();
        const instance = executePluginSource(source, plugin.id);

        if (instance?.onload) {
          instance.onload();
        }

        results.push({
          id: plugin.id,
          name: plugin.name,
          instance,
          status: "loaded",
        });

        console.log(`[PluginSandbox] Loaded: ${plugin.name} v${plugin.version}`);
      } catch (err) {
        results.push({
          id: plugin.id,
          name: plugin.name,
          instance: null,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    console.error("[PluginSandbox] Failed to fetch plugin list:", err);
  }

  return results;
}

/**
 * Unload all plugins by calling onunload().
 */
export function unloadPlugins(plugins: LoadedPlugin[]) {
  for (const p of plugins) {
    if (p.instance?.onunload) {
      try {
        p.instance.onunload();
      } catch (err) {
        console.error(`[PluginSandbox] Error unloading ${p.id}:`, err);
      }
    }
  }
}
