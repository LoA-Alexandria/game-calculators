"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { CollectionEditor } from "../../CollectionEditor";

export default function EditCollectionPage() {
  const { t } = useLocale();
  useDocumentTitle(t.collectionEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <CollectionEditor />
    </PermissionGate>
  );
}
