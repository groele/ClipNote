import { MessageType, onMessage } from "../shared/message-bus";
import type { Clip, Note } from "../shared/types";
import { db } from "../storage/indexeddb";
import { getSettings, saveSettings } from "../storage/sync-settings";

const CONTEXT_MENU_ID = "clipnote-save-selection";

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await saveSettings(settings);

  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Save to ClipNote",
    contexts: ["selection"],
  });
});

async function saveClipAndNote(payload: { text: string; url?: string; title?: string; timestamp: number }) {
  const clipId = crypto.randomUUID();
  const clip: Clip = {
    id: clipId,
    text: payload.text,
    sourceUrl: payload.url,
    sourceTitle: payload.title,
    capturedAt: payload.timestamp,
  };

  // 1. Save to IndexedDB
  try {
    await db.addClip(clip);
  } catch (e) {
    console.error("Failed to save clip to IndexedDB:", e);
  }

  // 2. Save to chrome.storage.local 'clips'
  const data = await chrome.storage.local.get(["clips", "notes", "settings"]);
  const clips: Clip[] = data.clips ?? [];
  clips.unshift(clip);
  
  const settings = data.settings ?? {};
  const maxClips = settings.maxQuickClips ?? 20;
  if (clips.length > maxClips) {
    clips.splice(maxClips);
  }
  await chrome.storage.local.set({ clips });

  // 3. Create and save corresponding Note
  const title = payload.text.trim().split("\n")[0].slice(0, 50) || "Quick Clip";
  const newNote: Note = {
    id: crypto.randomUUID(),
    title: title,
    markdown: payload.text,
    plainText: payload.text,
    sourceUrl: payload.url,
    sourceTitle: payload.title,
    tags: ["clip"],
    status: "inbox",
    createdAt: payload.timestamp,
    updatedAt: payload.timestamp,
  };

  // Save note to IndexedDB
  try {
    await db.addNote(newNote);
  } catch (e) {
    console.error("Failed to save note to IndexedDB:", e);
  }

  // Save note to chrome.storage.local
  const notes: Note[] = data.notes ?? [];
  notes.unshift(newNote);
  await chrome.storage.local.set({ notes });

  // 3b. Generate/Update Day, Week, and Month summaries
  try {
    await updatePeriodicSummaries(payload.timestamp);
  } catch (e) {
    console.error("Failed to update periodic summaries:", e);
  }

  // 4. Notify components
  chrome.runtime.sendMessage({ type: MessageType.CLIP_SAVED, payload: clip }).catch(() => {});

  // 5. Broadcast to all active content scripts in tabs
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: MessageType.CLIP_SAVED, payload: clip }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("Failed to broadcast CLIP_SAVED to tabs:", e);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;

  await saveClipAndNote({
    text: info.selectionText,
    url: tab?.url,
    title: tab?.title,
    timestamp: Date.now(),
  });
});

onMessage(MessageType.CLIP_SAVED, async (clip: Clip) => {
  try {
    await db.addClip(clip);
  } catch (e) {
    console.error("Failed to add clip on CLIP_SAVED fallback:", e);
  }
});

onMessage(MessageType.SAVE_CLIP, async (payload: { text: string; url: string; title: string; timestamp: number }) => {
  await saveClipAndNote(payload);
});

onMessage(MessageType.OPEN_SIDEBAR, async () => {
  await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
});

onMessage(MessageType.REQUEST_NOTES, async () => {
  return db.getAllNotes();
});

chrome.action.onClicked.addListener(async () => {
  await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
});

function getDomain(url?: string): string {
  if (!url) return "Quick Note";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function updatePeriodicSummaries(timestamp: number) {
  const data = await chrome.storage.local.get(["clips", "notes"]);
  const clips: Clip[] = data.clips ?? [];
  const notes: Note[] = data.notes ?? [];

  const targetDate = new Date(timestamp);
  const targetYear = targetDate.getFullYear();
  const targetMonthNum = targetDate.getMonth();
  const targetDayNum = targetDate.getDate();

  // Monday of target week
  const dayOfWeek = targetDate.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const targetMonday = new Date(targetDate);
  targetMonday.setDate(targetDate.getDate() + diffToMonday);
  targetMonday.setHours(0, 0, 0, 0);

  const targetSunday = new Date(targetMonday);
  targetSunday.setDate(targetMonday.getDate() + 6);
  targetSunday.setHours(23, 59, 59, 999);

  const formatYMD = (dt: Date) => {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const todayStr = formatYMD(targetDate);
  const weekStartStr = formatYMD(targetMonday);
  const weekEndStr = formatYMD(targetSunday);
  const monthStr = `${targetYear}-${String(targetMonthNum + 1).padStart(2, '0')}`;

  const formatClipMarkdown = (c: Clip) => {
    const timeStr = new Date(c.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const domain = getDomain(c.sourceUrl);
    const sourceLink = c.sourceUrl ? ` ([Source](${c.sourceUrl}))` : "";
    return `- **[${timeStr}]** (from ${domain}): ${c.text.trim()}${sourceLink}`;
  };

  // 1. Daily Summary
  const dailyClips = clips.filter(c => {
    const d = new Date(c.capturedAt);
    return d.getFullYear() === targetYear && d.getMonth() === targetMonthNum && d.getDate() === targetDayNum;
  }).sort((a, b) => a.capturedAt - b.capturedAt);

  if (dailyClips.length > 0) {
    const dailyId = `summary-day-${todayStr}`;
    const dailyTitle = `📅 Daily Summary: ${todayStr}`;
    const dailyMarkdown = `# Daily Clips Summary — ${todayStr}\n\n` +
      `Total clips: **${dailyClips.length}**\n\n` +
      dailyClips.map(formatClipMarkdown).join("\n\n");

    updateOrAddSummaryNote(notes, dailyId, dailyTitle, dailyMarkdown, "daily-summary", timestamp);
  }

  // 2. Weekly Summary
  const weeklyClips = clips.filter(c => {
    return c.capturedAt >= targetMonday.getTime() && c.capturedAt <= targetSunday.getTime();
  }).sort((a, b) => a.capturedAt - b.capturedAt);

  if (weeklyClips.length > 0) {
    const weeklyId = `summary-week-${weekStartStr}`;
    const weeklyTitle = `🗓️ Weekly Summary: ${weekStartStr} to ${weekEndStr}`;
    const weeklyMarkdown = `# Weekly Clips Summary\n` +
      `Period: **${weekStartStr}** to **${weekEndStr}**\n` +
      `Total clips: **${weeklyClips.length}**\n\n` +
      weeklyClips.map(formatClipMarkdown).join("\n\n");

    updateOrAddSummaryNote(notes, weeklyId, weeklyTitle, weeklyMarkdown, "weekly-summary", timestamp);
  }

  // 3. Monthly Summary
  const monthlyClips = clips.filter(c => {
    const d = new Date(c.capturedAt);
    return d.getFullYear() === targetYear && d.getMonth() === targetMonthNum;
  }).sort((a, b) => a.capturedAt - b.capturedAt);

  if (monthlyClips.length > 0) {
    const monthlyId = `summary-month-${monthStr}`;
    const monthlyTitle = `📚 Monthly Summary: ${monthStr}`;
    const monthlyMarkdown = `# Monthly Clips Summary — ${monthStr}\n\n` +
      `Total clips: **${monthlyClips.length}**\n\n` +
      monthlyClips.map(formatClipMarkdown).join("\n\n");

    updateOrAddSummaryNote(notes, monthlyId, monthlyTitle, monthlyMarkdown, "monthly-summary", timestamp);
  }

  await chrome.storage.local.set({ notes });
}

function updateOrAddSummaryNote(
  notes: Note[],
  id: string,
  title: string,
  markdown: string,
  tag: string,
  timestamp: number
) {
  const existingIndex = notes.findIndex(n => n.id === id);
  const noteContent: Note = {
    id,
    title,
    markdown,
    plainText: markdown.replace(/[#*`[\]()]/g, ""),
    tags: ["summary", tag],
    status: "inbox",
    createdAt: existingIndex >= 0 ? notes[existingIndex].createdAt : timestamp,
    updatedAt: timestamp
  };

  if (existingIndex >= 0) {
    notes[existingIndex] = noteContent;
  } else {
    notes.unshift(noteContent);
  }

  try {
    db.addNote(noteContent).catch(e => console.error("IndexedDB sync error for summary:", e));
  } catch (e) {
    console.error("IndexedDB sync error for summary:", e);
  }
}
