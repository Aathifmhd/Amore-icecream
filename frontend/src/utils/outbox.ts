/**
 * Changes waiting to reach the server.
 *
 * Every order / menu change is shown on screen straight away and queued here. The queue is
 * sent in order, kept in localStorage, and retried when the connection comes back, so a
 * shaky connection in the parlour never loses a status change.
 */
import { api, ApiError, isRetryable } from '../api';
import type { OrderRecord } from '../types';

interface QueuedWrite {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** The order this write changes, so a fetch that is older than it doesn't undo it on screen. */
  orderRef?: string;
  at: number;
}

const OUTBOX_KEY = 'amore_outbox_v1';
const MAX_AGE_MS = 3 * 24 * 3600 * 1000;
// Wait longer after each failed try (5 s, 10 s, 20 s … up to 5 minutes)
const FIRST_RETRY_MS = 5000;
const MAX_RETRY_MS = 5 * 60_000;
let retryMs = FIRST_RETRY_MS;

export const OUTBOX_EVENT = 'amore_outbox_changed';
/** detail: { message } — a change the server refused (it won't be retried). */
export const SYNC_ERROR_EVENT = 'amore_sync_error';

function read(): QueuedWrite[] {
  try {
    const list = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') as QueuedWrite[];
    return list.filter((w) => Date.now() - w.at < MAX_AGE_MS);
  } catch {
    return [];
  }
}

function write(list: QueuedWrite[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT));
}

/** How many changes haven't reached the server yet. */
export const pendingWrites = () => read().length;

/** Requests still waiting to be sent (e.g. "/menu/scoop-1"). */
export const pendingWritePaths = () => new Set(read().map((w) => w.path));

/** Orders with changes still on their way. Fetched copies of these are older than the screen. */
export const ordersWithPendingWrites = () => new Set(read().map((w) => w.orderRef).filter(Boolean) as string[]);

// Server time of the last confirmed write per order: a fetch that started before it is stale
const lastWriteAt = new Map<string, string>();
export const isStaleFetch = (ref: string, fetchServerTime: string) => {
  const written = lastWriteAt.get(ref);
  return Boolean(written && written > fetchServerTime);
};

let onOrderSaved: ((order: OrderRecord) => void) | null = null;
let onOrderRefused: ((orderReference: string) => void) | null = null;
/**
 * orderStorage registers what to do after a write: store the server's copy of the order,
 * or — when the server refused the change — reload the order so the screen matches the server.
 */
export const setOrderHandlers = (saved: (order: OrderRecord) => void, refused: (orderReference: string) => void) => {
  onOrderSaved = saved;
  onOrderRefused = refused;
};

export function queueWrite(w: Omit<QueuedWrite, 'id' | 'at'>): void {
  write([...read(), { ...w, id: crypto.randomUUID(), at: Date.now() }]);
  void flush();
}

let flushing: Promise<void> | null = null;
let retryTimer: number | undefined;

/** Send queued changes, oldest first. Stops at the first one that should be retried later. */
export function flush(): Promise<void> {
  if (!flushing) {
    // One tab at a time sends the shared queue
    const run = () => sendQueued();
    flushing = (navigator.locks ? navigator.locks.request(OUTBOX_KEY, run) : run()).finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function sendQueued(): Promise<void> {
  window.clearTimeout(retryTimer);
  for (;;) {
    const next = read()[0];
    if (!next) break;
    let saved: { order?: OrderRecord; serverTime?: string } | null = null;
    let refused = false;
    try {
      saved = await api(next.path, { method: next.method, body: next.body });
    } catch (err) {
      if (isRetryable(err)) {
        retryTimer = window.setTimeout(() => void flush(), retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        break;
      }
      // Already there (an earlier try got through before the connection dropped)
      const alreadySaved = err instanceof ApiError && err.status === 409 && next.method === 'POST';
      // Refused for good (not allowed, invalid, already gone): drop it and say so
      if (!alreadySaved) {
        refused = true;
        console.warn(`Change not saved (${next.method} ${next.path}):`, err);
        window.dispatchEvent(
          new CustomEvent(SYNC_ERROR_EVENT, {
            detail: { message: err instanceof ApiError ? err.message : 'A change could not be saved' },
          })
        );
      }
    }
    retryMs = FIRST_RETRY_MS;
    write(read().filter((w) => w.id !== next.id));
    if (next.orderRef && saved?.serverTime) lastWriteAt.set(next.orderRef, saved.serverTime);
    if (saved?.order && onOrderSaved) onOrderSaved(saved.order);
    if (refused && next.orderRef && onOrderRefused) onOrderRefused(next.orderRef);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    retryMs = FIRST_RETRY_MS;
    void flush();
  });
  // Anything left from last time
  window.setTimeout(() => void flush(), 1500);
}
