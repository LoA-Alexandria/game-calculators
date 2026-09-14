"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { ArtworkEditor } from "../../ArtworkEditor";

export default function EditArtworkPage() {
  const { t } = useLocale();
  useDocumentTitle(t.artworkEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <ArtworkEditor />
    </PermissionGate>
  );
}
