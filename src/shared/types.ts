export interface Note {
  id: string;
  title: string;
  markdown: string;
  plainText: string;
  sourceUrl?: string;
  sourceTitle?: string;
  tags: string[];
  projectId?: string;
  status: "inbox" | "archived" | "favorite";
  createdAt: number;
  updatedAt: number;
}

export interface Clip {
  id: string;
  text: string;
  html?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  capturedAt: number;
}

export interface AppSettings {
  theme: "light" | "dark" | "auto";
  autoTag: boolean;
  maxQuickClips: number;
  iconColor: "indigo" | "blue" | "green" | "rose" | "amber";
  customFabIcon?: string;
  fabOpacity: number;
  fabSize: number;
  showSelectionCapture: boolean;
  showFab: boolean;
  enablePrivacyMask: boolean;
  enableProximityAwareness: boolean;
}
