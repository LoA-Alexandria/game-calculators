"use client";

import { useDocumentTitle, useLocale } from "../../../../components/LocaleProvider";
import { PermissionGate } from "../../../../components/SignInGate";
import { BuildingLevelsEditor } from "../../../BuildingLevelsEditor";

export default function EditBuildingLevelsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.buildingLevelsEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <BuildingLevelsEditor />
    </PermissionGate>
  );
}
