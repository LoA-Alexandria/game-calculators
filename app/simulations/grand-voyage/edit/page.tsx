"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { GrandVoyageEditor } from "../../../calculators/GrandVoyageEditor";

export default function EditGrandVoyagePage() {
  const { t } = useLocale();
  useDocumentTitle(t.voyageEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <GrandVoyageEditor />
    </PermissionGate>
  );
}
