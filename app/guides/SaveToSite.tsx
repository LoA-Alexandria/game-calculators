"use client";

import { useState } from "react";
import { dataFits } from "../../lib/content/guide-data";
import { getDictionary, LOCALE_CODES, type Locale } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { useLocale } from "../components/LocaleProvider";
import { CheckIcon } from "../components/Icons";
import { usePublishedOverrides } from "./GuideOverrides";
import { publishGuide, saveGuideDraft, type SaveState } from "./useGuideContent";
import { publishData, saveDataDraft, uploadPictures, withUploadedPictures } from "./useGuideData";

type Props = {
  /** The data file this editor writes, by its name under `lib/data/`. */
  file: string;
  /** The data as the editor would export it. */
  data: unknown;
  /**
   * Further files this editor writes in the same press — the lore of one
   * roster is a file per language, and saving German without French would
   * leave a page half translated.
   */
  more?: readonly { file: string; data: unknown }[];
  /** Pictures the export adds, as data URLs, if the editor has any. */
  uploads?: readonly { file: string; data: string }[];
  /** Where committed pictures for this guide live under `public/`. */
  folder?: string;
  /** The guide whose dictionary entry holds the words this editor writes. */
  guideId?: string;
  /**
   * Those words, by the field they sit in: `heroTexts`, `buildTexts`,
   * `pickNotes` and so on, each with one catalogue per language. An editor
   * that writes no words leaves this out; one that writes several fields names
   * them all, because they are published together.
   */
  texts?: Record<string, Partial<Record<Locale, unknown>>>;
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
export function SaveToSite({ file, data, more = [], uploads = [], folder, guideId, texts }: Props) {
  const { t } = useLocale();
  const { session, allows } = useAuth();
  const published = usePublishedOverrides(guideId);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const words = t.editor;

  if (!session || !allows("guides.draft")) return null;

  const fits = dataFits(file, data) && more.every((entry) => dataFits(entry.file, entry.data));

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

    for (const entry of more) {
      if (!dataFits(entry.file, entry.data)) return stop(words.saveToSiteUnfit);
      const failed = await saveDataDraft(entry.file, entry.data, session.userId);
      if (failed) return stop(failed);
    }

    // The languages this press wrote a draft for, and so the ones to publish.
    // A name put back to the committed one leaves an empty draft rather than
    // no draft, because publishing that is what takes the live row away.
    const drafted: Locale[] = [];
    const fields = texts ? Object.keys(texts) : [];
    if (guideId && fields.length > 0) {
      for (const locale of LOCALE_CODES) {
        const entry = getDictionary(locale).guideEntries as Record<string, Record<string, unknown>>;
        const base = entry[guideId];
        if (!base) continue;
        // Every field this editor writes goes into one draft, so publishing a
        // rename cannot leave the note beside it behind.
        const edited = { ...base };
        const wrote: string[] = [];
        for (const field of fields) {
          const catalogue = texts?.[field]?.[locale];
          if (catalogue === undefined) continue;
          edited[field] = catalogue;
          wrote.push(field);
        }
        if (wrote.length === 0) continue;
        const failed = await saveGuideDraft(
          guideId,
          locale,
          base,
          edited,
          session.userId,
          wrote,
          published[locale],
        );
        if (failed) return stop(failed);
        drafted.push(locale);
      }
    }

    if (andPublish) {
      const refused = await publishData(file);
      if (refused) return stop(refused);
      for (const entry of more) {
        const denied = await publishData(entry.file);
        if (denied) return stop(denied);
      }
      for (const locale of drafted) {
        const denied = await publishGuide(guideId as string, locale);
        if (denied) return stop(denied);
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
