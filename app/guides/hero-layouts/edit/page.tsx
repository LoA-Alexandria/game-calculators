"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { HeroLayoutsEditor } from "../../HeroLayoutsEditor";

export default function EditHeroLayoutsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.layoutEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <HeroLayoutsEditor />
    </PermissionGate>
  );
}
