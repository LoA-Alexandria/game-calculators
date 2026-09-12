"use client";

type Listener = () => void;

/**
 * A localStorage-backed value exposed as a React external store.
 *
 * Reading a browser-only value during render would break hydration, and
 * reading it in an effect means a setState round trip on every load. This is
 * the shape `useSyncExternalStore` exists for: `getServerSnapshot` supplies the
 * value baked into the exported HTML, and React re-renders with the real one
 * immediately after hydrating.
 *
 * The parsed value is cached, so `getSnapshot` keeps returning the same
 * reference — required by React, and the reason objects work here and not just
 * strings.
 *
 * A write from another tab arrives through the `storage` event, which is also
 * how the embedded Irrigation Planner follows the site theme.
 */
export function createPersistentStore<T>(options: {
  key: string;
  /** Value the pre-rendered HTML was built with. */
  serverValue: T;
  /** Validates what is in storage; return null to fall back. */
  parse: (raw: string | null) => T | null;
  /** Used when storage holds nothing usable. Runs in the browser only. */
  fallback: () => T;
  /** Defaults to `String`; pass `JSON.stringify` for objects. */
  serialize?: (value: T) => string;
}) {
  const { key, serverValue, parse, fallback, serialize = String } = options;
  const listeners = new Set<Listener>();
  let cache: T;
  let loaded = false;

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        loaded = false;
        emit();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },

    getSnapshot(): T {
      if (!loaded) {
        let raw: string | null = null;
        try { raw = localStorage.getItem(key); } catch { /* storage unavailable */ }
        cache = parse(raw) ?? fallback();
        loaded = true;
      }
      return cache;
    },

    getServerSnapshot(): T {
      return serverValue;
    },

    set(value: T) {
      cache = value;
      loaded = true;
      try { localStorage.setItem(key, serialize(value)); } catch { /* storage unavailable */ }
      emit();
    },

    clear() {
      loaded = false;
      try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
      emit();
    },
  };
}
