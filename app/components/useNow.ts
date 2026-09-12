"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * The current time, as an external store.
 *
 * The site is pre-rendered at build time, so anything derived from `Date.now()`
 * during render would differ between the exported HTML and the browser and
 * break hydration. `getServerSnapshot` therefore reports 0, which callers read
 * as "not known yet" and render a neutral placeholder for; the real clock
 * arrives on hydration.
 *
 * The value is bucketed to whole minutes so repeated reads return the same
 * number — React requires a stable snapshot — and a re-render happens at most
 * once a minute rather than on every frame.
 */
const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, MINUTE);
  // a tab that was in the background can be far behind; catch up on return
  const onVisible = () => { if (!document.hidden) onChange(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

function getSnapshot(): number {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Returns the current `Date`, or null while still rendering the export.
 *
 * Memoised on the bucketed stamp: a fresh `Date` on every render would make
 * every `useMemo` downstream recompute, which is most of what this hook exists
 * to avoid.
 */
export function useNow(): Date | null {
  const stamp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => (stamp === 0 ? null : new Date(stamp)), [stamp]);
}
