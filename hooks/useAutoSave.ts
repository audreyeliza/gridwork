import { useEffect, useRef } from "react";

export type UseAutoSaveOptions = {
  /** When false, no timer is scheduled. A pending write is flushed when enabled drops. */
  enabled: boolean;
  /** Debounce after the last dirty change (default 2000 ms). */
  delayMs?: number;
  /** Value that changes when persisted payload should be considered dirty. */
  dirtyKey: string;
  /** Persist current state; should read latest refs/state inside. */
  onSave: () => Promise<void>;
};

/**
 * Debounced save. Dirty-key changes reschedule the timer but keep the pending flag.
 * Pending work is flushed on tab hide, pagehide, beforeunload, disable, and unmount.
 * Saves are chained so a flush waits for an in-flight upsert.
 */
export function useAutoSave({ enabled, delayMs = 2000, dirtyKey, onSave }: UseAutoSaveOptions): void {
  const onSaveRef = useRef(onSave);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const chainRef = useRef(Promise.resolve());

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const runSave = () => {
    chainRef.current = chainRef.current
      .then(() => onSaveRef.current())
      .catch(() => undefined);
    return chainRef.current;
  };

  const flushPending = () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (!pendingRef.current) return;
    pendingRef.current = false;
    void runSave();
  };

  useEffect(() => {
    if (!enabled) {
      flushPending();
      return;
    }

    pendingRef.current = true;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      pendingRef.current = false;
      void runSave();
    }, delayMs);

    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      // Keep pending so hide/unmount/disable still flush the latest refs.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delayMs, dirtyKey]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    const onHide = () => flushPending();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      flushPending();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
