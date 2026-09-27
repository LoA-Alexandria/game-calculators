"use client";

import { useState } from "react";
import { dataFits } from "../../lib/content/guide-data";
import { getDictionary, LOCALE_CODES, type Locale } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { useLocale } from "../components/LocaleProvider";
import { CheckIcon } from "../components/Icons";
import { publishGuide, saveGuideDraft, type SaveState } from "./useGuideContent";
import { publishData, saveDataDraft, uploadPictures, withUploadedPictures } from "./useGuideData";

type Props = {
  /** The data file this editor writes, by its name under `lib/data/`. */
  file: string;
  /** The data as the editor would export it. */
  data: unknown;
  /** Pictures the export adds, as data URLs, if the editor has any. */
  uploads?: readonly { file: string; data: string }[];
  /** Where committed pictures for this guide live under `public/`. */
  folder?: string;
  /**
   * The guide whose dictionary entry holds the names, and the field they sit
   * in — `heroTexts`, `catalogTexts` and so on. Guides with no per-entry names
   * leave both out.
   */
  guideId?: string;
  textField?: string;
  texts?: Partial<Record<Locale, unknown>>;
};

/**
 * Save and Publish, for any editor.
 *
 * Every editor already builds exactly what its file should contain; this only
 * sends it. The order matters and is fixed: pictures first, because an entry
 * must never name one that is not there yet; then the data; then the names,
 * per language, because the guides read those in preference to the file and
 * saving one without the other renames nothing.
 *
 * Publishing is a separate press, and the database checks the role rather than
 * trusting the button.
 */
export function SaveToSite({ file, data, uploads = [], folder, guideId, textField, texts }: Props) {
  const { t } = useLocale();
  const { session, allows } = useAuth();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const words = t.editor;

  if (!session || !allows("guides.draft")) return null;

  const fits = dataFits(file, data);

  const run = async (andPublish: boolean) => {
    setState("saving");
    setError("");

    let payload = data;
    if (uploads.length > 0) {
      const { renamed, error: failed } = await uploadPictures(folder ?? file, uploads);
      if (failed) return stop(failed);
      payload = withUploadedPictures(data, renamed);
    }
    if (!dataFits(file, payload)) return stop(words.saveToSiteUnfit);

    const wrote = await saveDataDraft(file, payload, session.userId);
    if (wrote) return stop(wrote);

    if (guideId && textField && texts) {
      for (const locale of LOCALE_CODES) {
        const entry = getDictionary(locale).guideEntries as Record<string, Record<string, unknown>>;
        const base = entry[guideId];
        if (!base || texts[locale] === undefined) continue;
        const failed = await saveGuideDraft(
          guideId,
          locale,
          base,
          { ...base, [textField]: texts[locale] },
          session.userId,
        );
        if (failed) return stop(failed);
      }
    }

    if (andPublish) {
      const refused = await publishData(file);
      if (refused) return stop(refused);
      if (guideId && textField && texts) {
        for (const locale of LOCALE_CODES) {
          const entry = getDictionary(locale).guideEntries as Record<string, Record<string, unknown>>;
          const base = entry[guideId];
          // A language whose names match the committed ones leaves no draft,
          // and publishing one that is not there is not worth an error.
          if (!base || JSON.stringify(texts[locale]) === JSON.stringify(base[textField])) continue;
          const denied = await publishGuide(guideId, locale);
          if (denied) return stop(denied);
        }
      }
    }

    setState("saved");
    window.setTimeout(() => setState("idle"), 2500);
  };

  function stop(message: string) {
    setError(message);
    setState("failed");
  }

  const hint = !fits
    ? words.saveToSiteUnfit
    : uploads.length > 0
      ? `${uploads.length} ${words.saveToSitePicturesShort}`
      : "";

  return (
    <>
      <button
        className="button"
        type="button"
        disabled={!fits || state === "saving"}
        title={hint || undefined}
        onClick={() => void run(false)}
      >
        <CheckIcon className="icon icon-sm" />
        {state === "saving" ? words.saving : state === "saved" ? words.savedToSite : words.saveToSite}
      </button>
      {allows("guides.publish") ? (
        <button
          className="button"
          type="button"
          disabled={!fits || state === "saving"}
          onClick={() => void run(true)}
        >
          {words.publishNow}
        </button>
      ) : null}
      {error ? (
        <span className="tier-edit-status result-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
