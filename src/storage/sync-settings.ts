import type { AppSettings } from "../shared/types";

const SETTINGS_KEY = "clipnote-settings";

const DEFAULTS: AppSettings = {
  theme: "auto",
  autoTag: true,
  maxQuickClips: 50,
  iconColor: "indigo",
};

export async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULTS, ...result[SETTINGS_KEY] };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
