/** Opens the Sol chat sheet from anywhere (e.g. the Sol button in the menu bar). */
export const OPEN_SOL_CHAT_EVENT = "tala:open-sol-chat";

export function openSolChat(): void {
  window.dispatchEvent(new Event(OPEN_SOL_CHAT_EVENT));
}
