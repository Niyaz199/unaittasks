"use client";

import { useSearchParams } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { RoundsScannerConfigProvider } from "@/components/rounds/rounds-scanner-config-provider";
import { RoundsEntryForm } from "@/components/rounds/rounds-entry-form";
import { RoundsScanner } from "@/components/rounds/rounds-scanner";

export function RoundsScanScreen({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return (
    <RoundsScannerConfigProvider>
      {token ? (
        <>
          <PageHeader
            title="Подтверждение обхода"
            description="Проверьте помещение, при необходимости добавьте комментарий или фото и сохраните отметку."
            actions={<BackButton fallback="/rounds/scan" label="← Назад к сканеру" />}
          />
          <RoundsEntryForm token={token} userId={userId} />
        </>
      ) : (
        <>
          <PageHeader
            title="Сканер обходов"
            description="Быстрая отметка помещения по QR с офлайн-очередью и последующей синхронизацией."
          />
          <RoundsScanner />
        </>
      )}
    </RoundsScannerConfigProvider>
  );
}
