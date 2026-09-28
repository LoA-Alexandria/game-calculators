"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { TheaterIncomeEditor } from "../../TheaterIncomeEditor";

export default function EditTheaterIncomePage() {
  const { t } = useLocale();
  useDocumentTitle(t.theaterIncomeEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <TheaterIncomeEditor />
    </PermissionGate>
  );
}
