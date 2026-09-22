"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { HeroLevelingEditor } from "../../HeroLevelingEditor";

export default function EditHeroLevelingPage() {
  const { t } = useLocale();
  useDocumentTitle(t.levelingEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <HeroLevelingEditor />
    </PermissionGate>
  );
}
