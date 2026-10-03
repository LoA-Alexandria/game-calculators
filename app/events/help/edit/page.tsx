"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { EventWikiEditor } from "../../EventWikiEditor";

export default function EditEventHelpPage() {
  const { t } = useLocale();
  useDocumentTitle(t.eventWikiEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <EventWikiEditor />
    </PermissionGate>
  );
}
