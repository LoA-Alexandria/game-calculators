"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { ServerAgeUnlocksEditor } from "../../ServerAgeUnlocksEditor";

export default function EditServerAgeUnlocksPage() {
  const { t } = useLocale();
  useDocumentTitle(t.ageUnlocksEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <ServerAgeUnlocksEditor />
    </PermissionGate>
  );
}
