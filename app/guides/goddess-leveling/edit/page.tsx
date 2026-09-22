"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { GoddessLevelingEditor } from "../../GoddessLevelingEditor";

export default function EditGoddessLevelingPage() {
  const { t } = useLocale();
  useDocumentTitle(t.goddessLevelingEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <GoddessLevelingEditor />
    </PermissionGate>
  );
}
