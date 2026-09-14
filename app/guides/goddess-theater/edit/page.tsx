"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { GoddessTheaterEditor } from "../../GoddessTheaterEditor";

export default function EditGoddessTheaterPage() {
  const { t } = useLocale();
  useDocumentTitle(t.theaterEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <GoddessTheaterEditor />
    </PermissionGate>
  );
}
