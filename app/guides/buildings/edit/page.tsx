"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { BuildingsEditor } from "../../BuildingsEditor";

export default function EditBuildingsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.buildingsEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <BuildingsEditor />
    </PermissionGate>
  );
}
