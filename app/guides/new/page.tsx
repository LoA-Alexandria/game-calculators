"use client";

import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PermissionGate } from "../../components/SignInGate";
import { GuideEditor } from "../GuideEditor";

export default function NewGuidePage() {
  const { t } = useLocale();
  useDocumentTitle(t.editor.title);
  return (
    <PermissionGate permission="guides.draft">
      <GuideEditor />
    </PermissionGate>
  );
}
