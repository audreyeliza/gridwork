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
 */
export function useAutoSave({ enabled, delayMs = 2000, dirtyKey, onSave }: UseAutoSaveOptions): void {
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => {
      void onSaveRef.current();
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [enabled, delayMs, dirtyKey]);
}
