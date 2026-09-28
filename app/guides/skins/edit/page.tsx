"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { SkinsEditor } from "../../SkinsEditor";

export default function EditSkinsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.skinsEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <SkinsEditor />
    </PermissionGate>
  );
}
