"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { CryptidesEditor } from "../../CryptidesEditor";

export default function EditCryptidesPage() {
  const { t } = useLocale();
  useDocumentTitle(t.cryptidesEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <CryptidesEditor />
    </PermissionGate>
  );
}
