"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { AnecdotesEditor } from "../../AnecdotesEditor";

export default function EditAnecdotesPage() {
  const { t } = useLocale();
  useDocumentTitle(t.anecdoteEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <AnecdotesEditor />
    </PermissionGate>
  );
}
