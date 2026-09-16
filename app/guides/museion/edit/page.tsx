"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { MuseionEditor } from "../../MuseionEditor";

export default function EditMuseionPage() {
  const { t } = useLocale();
  useDocumentTitle(t.museionEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <MuseionEditor />
    </PermissionGate>
  );
}
