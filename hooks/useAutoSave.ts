import { useEffect, useRef } from "react";

export type UseAutoSaveOptions = {
  /** When false, no timer is scheduled. */
  enabled: boolean;
  /** Debounce after the last dirty change (default 2000 ms). */
  delayMs?: number;
  /** Value that changes when persisted payload should be considered dirty. */
  dirtyKey: string;
  /** Persist current state; should read latest refs/state inside. */
  onSave: () => Promise<void>;
};

/**
 * Debounced save: schedules `onSave` when `dirtyKey` changes, after `delayMs` of quiet time.
 * Flushes immediately on unmount, page hide, or tab backgrounding so zone switches do not
 * drop pending edits. DirtyKey reschedules only reset the timer (normal debounce).
 */
export function useAutoSave({ enabled, delayMs = 2000, dirtyKey, onSave }: UseAutoSaveOptions): void {
  const onSaveRef = useRef(onSave);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Debounce: reschedule on dirtyKey; clear timer without flushing.
  useEffect(() => {
    if (!enabled) {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      return;
    }

    pendingRef.current = true;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      pendingRef.current = false;
      void onSaveRef.current();
    }, delayMs);

    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [enabled, delayMs, dirtyKey]);

  // Flush on leave: unmount, disable, tab hide, or pagehide.
  useEffect(() => {
    if (!enabled) return;

    const flushPending = () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      if (!pendingRef.current) return;
      pendingRef.current = false;
      void onSaveRef.current();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushPending();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushPending);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushPending);
      flushPending();
    };
  }, [enabled]);
}
