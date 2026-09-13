"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { HeroTierEditor } from "../../HeroTierEditor";

export default function EditHeroTierListPage() {
  const { t } = useLocale();
  useDocumentTitle(t.tierEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <HeroTierEditor />
    </PermissionGate>
  );
}
