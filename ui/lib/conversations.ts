/* -------------------------------------------------------------------------- */
/*  Conversation store                                                        */
/*                                                                            */
/*  Metadata only — id, title, updatedAt. Message bodies still live in        */
/*  sessionStorage under `inquira:conv:<id>`, managed by ChatClient.          */
/* -------------------------------------------------------------------------- */

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
};

const KEY = "inquira:conversations";
const EVENT = "inquira:conversations-changed";
const MAX_ITEMS = 30;

export function listConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (c): c is Conversation =>
          !!c &&
          typeof c === "object" &&
          typeof (c as Conversation).id === "string" &&
          typeof (c as Conversation).title === "string" &&
          typeof (c as Conversation).updatedAt === "number",
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Insert or update a conversation by id.
 *  - First call for an id: creates the entry with the passed title.
 *  - Later calls: bump `updatedAt` and move to top, but keep the ORIGINAL
 *    title so follow-up messages don't rename the thread.
 */
export function saveConversation(id: string, title?: string): void {
  if (typeof window === "undefined") return;
  if (!id) return;
  const trimmed = (title ?? "").trim().slice(0, 80);
  try {
    const all = listConversations();
    const existing = all.find((c) => c.id === id);
    const rest = all.filter((c) => c.id !== id);
    rest.unshift({
      id,
      title: existing?.title ?? trimmed ?? "Untitled research",
      updatedAt: Date.now(),
    });
    window.localStorage.setItem(KEY, JSON.stringify(rest.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* quota / private mode */
  }
}

export function removeConversation(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = listConversations().filter((c) => c.id !== id);
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function clearConversations(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function subscribeConversations(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}