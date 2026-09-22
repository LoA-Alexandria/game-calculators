"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { HeroLinkingEditor } from "../../HeroLinkingEditor";

export default function EditHeroLinkingPage() {
  const { t } = useLocale();
  useDocumentTitle(t.linkingEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <HeroLinkingEditor />
    </PermissionGate>
  );
}
