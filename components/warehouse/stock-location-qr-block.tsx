"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { downloadQrPng } from "@/lib/qr/export";

type ActiveQrCode = {
  qr_token: string;
  generated_at: string;
  is_active: boolean;
} | null;

type Props = {
  locationId: string;
  objectName: string;
  locationName: string;
  qrCode: ActiveQrCode;
  canRegenerate: boolean;
};

export function StockLocationQrBlock({ locationId, objectName, locationName, qrCode, canRegenerate }: Props) {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  if (!qrCode) {
    return <div className="text-soft">Активный QR для места хранения не найден.</div>;
  }

  const activeQrCode = qrCode;
  const qrHref = `/warehouse/scan/${activeQrCode.qr_token}`;
  const qrUrl = baseUrl ? `${baseUrl}${qrHref}` : qrHref;

  async function handleCopy() {
    if (!baseUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error(error);
    }
  }

  function handleDownload() {
    if (!svgRef.current) return;
    downloadQrPng({
      svgElement: svgRef.current,
      fileName: `warehouse-location-${locationName}.png`,
      eyebrow: objectName,
      title: locationName,
      token: activeQrCode.qr_token,
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/warehouse/locations/${encodeURIComponent(locationId)}/qr/regenerate`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Не удалось пересоздать QR.");
        return;
      }
      setMessage("QR пересоздан.");
      router.refresh();
    });
  }

  return (
    <div className="warehouse-qr-shell">
      <div className="warehouse-qr-layout">
        <div className="warehouse-qr-preview">
          <QRCodeSVG value={baseUrl ? qrUrl : qrHref} size={132} level="H" includeMargin ref={svgRef} />
          <div className="warehouse-qr-preview-eyebrow">{objectName}</div>
          <div className="warehouse-qr-preview-title">{locationName}</div>
        </div>

        <div className="warehouse-qr-content">
          <div className="warehouse-qr-meta">
            <div className="text-soft">Токен</div>
            <div className="warehouse-qr-token">{activeQrCode.qr_token}</div>
          </div>
          <div className="warehouse-qr-stats">
            <div className="warehouse-qr-stat">
              <div className="text-soft">Сгенерирован</div>
              <div>{new Date(activeQrCode.generated_at).toLocaleString("ru-RU")}</div>
            </div>
            <div className="warehouse-qr-stat">
              <div className="text-soft">Статус</div>
              <div>{activeQrCode.is_active ? "Активен" : "Неактивен"}</div>
            </div>
          </div>

          <div className="warehouse-qr-actions">
            <button type="button" className="btn btn-ghost" onClick={handleCopy}>
              {copied ? "Скопировано!" : "Копировать ссылку"}
            </button>
            <a href={qrHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost warehouse-qr-link">
              Открыть
            </a>
            <button type="button" className="btn btn-ghost" onClick={handleDownload}>
              Скачать PNG
            </button>
            {canRegenerate ? (
              <button type="button" className="btn btn-ghost" onClick={handleRegenerate} disabled={pending}>
                {pending ? "Пересоздание..." : "Пересоздать"}
              </button>
            ) : null}
          </div>

          {message ? <div className="text-soft warehouse-qr-message">{message}</div> : null}
        </div>
      </div>
    </div>
  );
}
