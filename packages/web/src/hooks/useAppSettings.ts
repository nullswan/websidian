import { useState, useEffect, useCallback, useRef } from "react";
import { loadSettings, type AppSettings } from "../components/Settings.js";
import { loadHotkeyOverrides, buildHotkeyMap } from "../lib/hotkeys.js";

export type { AppSettings };

export function useAppSettings() {
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings);
  const hotkeyMapRef = useRef(buildHotkeyMap(loadHotkeyOverrides()));

  const refreshHotkeyMap = useCallback(() => {
    hotkeyMapRef.current = buildHotkeyMap(loadHotkeyOverrides());
  }, []);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appSettings.theme);
  }, [appSettings.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("heading-numbers-enabled", appSettings.headingNumbers);
  }, [appSettings.headingNumbers]);

  useEffect(() => {
    document.documentElement.classList.toggle("reader-focus-active", appSettings.readerFocusMode);
  }, [appSettings.readerFocusMode]);

  return { appSettings, setAppSettings, hotkeyMapRef, refreshHotkeyMap } as const;
}
