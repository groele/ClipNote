export enum MessageType {
  SAVE_CLIP = "SAVE_CLIP",
  CLIP_SAVED = "CLIP_SAVED",
  OPEN_SIDEBAR = "OPEN_SIDEBAR",
  REQUEST_NOTES = "REQUEST_NOTES",
  SYNC_COMPLETE = "SYNC_COMPLETE",
  GET_SELECTED_TEXT = "GET_SELECTED_TEXT"
}

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export function sendMessage<T = unknown, R = void>(type: MessageType, payload?: T): Promise<R> {
  return chrome.runtime.sendMessage({ type, payload });
}

export function onMessage<T = unknown, R = void>(
  type: MessageType,
  handler: (payload: T, sender: chrome.runtime.MessageSender) => R | Promise<R>
): void {
  chrome.runtime.onMessage.addListener((message: Message<T>, sender, sendResponse) => {
    if (message.type === type) {
      const result = handler(message.payload as T, sender);
      if (result instanceof Promise) {
        result.then(sendResponse);
        return true;
      }
      sendResponse(result);
    }
  });
}
