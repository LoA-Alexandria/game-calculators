"use client";

import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PermissionGate } from "../../components/SignInGate";
import { NewsEditor } from "../NewsEditor";

export default function NewNewsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.newsEditor.title);
  return (
    <PermissionGate permission="news.write">
      <NewsEditor />
    </PermissionGate>
  );
}
