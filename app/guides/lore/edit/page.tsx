"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { LoreEditor } from "../../LoreEditor";

export default function EditLorePage() {
  const { t } = useLocale();
  useDocumentTitle(t.loreEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <LoreEditor />
    </PermissionGate>
  );
}
