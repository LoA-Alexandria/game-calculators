"use client";

import { useDocumentTitle, useLocale } from "../../../components/LocaleProvider";
import { PermissionGate } from "../../../components/SignInGate";
import { CollectionLayoutsEditor } from "../../CollectionLayoutsEditor";

export default function EditCollectionLayoutsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.collectionLayoutsEditor.title);
  return (
    <PermissionGate permission="guides.draft">
      <CollectionLayoutsEditor />
    </PermissionGate>
  );
}
