"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { ProductionBuildingsEditor } from "../../ProductionBuildingsEditor";

export default function EditProductionBuildingsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.productionBuildingsEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <ProductionBuildingsEditor />
    </PermissionGate>
  );
}
