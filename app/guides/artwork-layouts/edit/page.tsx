"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { ArtworkLayoutEditor } from "../../ArtworkLayoutEditor";

export default function EditArtworkLayoutsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.artworkLayoutEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <ArtworkLayoutEditor />
    </PermissionGate>
  );
}
