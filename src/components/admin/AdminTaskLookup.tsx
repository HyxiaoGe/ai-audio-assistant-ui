"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n-context";

export default function AdminTaskLookup() {
  const { t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = () => {
    const id = value.trim();
    if (id) router.push(`/admin/tasks/${id}`);
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--app-text-muted)]">{t("admin.taskLookup.label")}</label>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder={t("admin.taskLookup.placeholder")}
        />
      </div>
      <Button onClick={go} disabled={!value.trim()}>
        {t("admin.taskLookup.go")}
      </Button>
    </div>
  );
}
