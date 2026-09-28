"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { TradeSetsEditor } from "../../TradeSetsEditor";

export default function EditTradeSetsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.tradeSetsEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <TradeSetsEditor />
    </PermissionGate>
  );
}
