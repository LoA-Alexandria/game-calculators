"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { HeroEditor } from "../../HeroEditor";

export default function EditHeroesPage() {
  const { t } = useLocale();
  useDocumentTitle(t.heroEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <HeroEditor />
    </PermissionGate>
  );
}
