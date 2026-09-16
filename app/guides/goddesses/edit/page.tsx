"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { GoddessEditor } from "../../GoddessEditor";

export default function EditGoddessesPage() {
  const { t } = useLocale();
  useDocumentTitle(t.goddessEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <GoddessEditor />
    </PermissionGate>
  );
}
