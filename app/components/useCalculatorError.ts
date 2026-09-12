"use client";

import { useCallback } from "react";
import { isCalculatorError } from "../../lib/calculators/errors";
import { useLocale } from "./LocaleProvider";

/**
 * Turns a thrown validation error into a message in the reader's language.
 * Falls back to a generic sentence for anything that is not a
 * `CalculatorError`, so an unexpected failure never shows English internals.
 *
 * The returned function is stable for a given language, so it is safe to list
 * in a `useMemo` dependency array.
 */
export function useCalculatorError(): (error: unknown) => string {
  const { t, tf } = useLocale();
  return useCallback(
    (error: unknown) => {
      if (isCalculatorError(error)) {
        const template = (t.errors as Record<string, string>)[error.code];
        if (template) return tf(template, error.params);
      }
      return t.errors.generic;
    },
    [t, tf],
  );
}
