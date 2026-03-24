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
  roomId: string;
  roomName: string;
  qrCode: ActiveQrCode;
  canRegenerate: boolean;
};

export function ObjectRoomQrBlock({ roomId, roomName, qrCode, canRegenerate }: Props) {
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
    return <div className="text-soft">Активный QR для помещения не найден.</div>;
  }

  const activeQr = qrCode;
  const qrHref = `/ppr/rooms/qr/${activeQr.qr_token}`;
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
      fileName: `room-${roomName}.png`,
      title: roomName,
      subtitle: "Карточка помещения",
      token: activeQr.qr_token,
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/ppr/rooms/${encodeURIComponent(roomId)}/qr/regenerate`, {
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
    <div className="grid" style={{ gap: "1rem" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: "1.5rem", flexWrap: "wrap" }}>
        <div
          style={{
            padding: "0.75rem",
            background: "#fff",
            borderRadius: "12px",
            width: "max-content",
            display: "grid",
            gap: "0.6rem",
            justifyItems: "center",
          }}
        >
          <QRCodeSVG value={baseUrl ? qrUrl : qrHref} size={160} level="H" includeMargin ref={svgRef} />
          <div style={{ color: "#111827", fontWeight: 600, maxWidth: "160px", textAlign: "center", lineHeight: 1.35 }}>
            {roomName}
          </div>
        </div>

        <div className="grid" style={{ gap: "0.75rem", flex: 1, minWidth: "220px" }}>
          <div>
            <div className="text-soft">Токен</div>
            <div style={{ fontFamily: "monospace", fontSize: "1.05rem", wordBreak: "break-all" }}>{activeQr.qr_token}</div>
          </div>
          <div className="row" style={{ gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div className="text-soft">Сгенерирован</div>
              <div>{new Date(activeQr.generated_at).toLocaleString("ru-RU")}</div>
            </div>
            <div>
              <div className="text-soft">Статус</div>
              <div>{activeQr.is_active ? "Активен" : "Неактивен"}</div>
            </div>
          </div>

          <div className="row" style={{ gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={handleCopy}>
              {copied ? "Скопировано!" : "Копировать ссылку"}
            </button>
            <a href={qrHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ textDecoration: "none" }}>
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

          {message ? <div className="text-soft">{message}</div> : null}
        </div>
      </div>
    </div>
  );
}
