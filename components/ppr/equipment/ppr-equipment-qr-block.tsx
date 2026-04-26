"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { downloadQrPng } from "@/lib/qr/export";

type ActiveQrCode = {
  qr_token: string;
  generated_at: string;
  is_active: boolean;
};

type Props = {
  qrCode: ActiveQrCode | null;
  objectName?: string;
  equipmentName?: string;
  inventoryNo?: string;
};

export function PprEquipmentQrBlock({
  qrCode,
  objectName,
  equipmentName,
  inventoryNo,
}: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  if (!qrCode) {
    return <div className="text-soft">Активный QR для оборудования не найден.</div>;
  }
  const activeQr = qrCode;
  const qrHref = `/ppr/qr/${activeQr.qr_token}`;
  const qrUrl = baseUrl ? `${baseUrl}${qrHref}` : qrHref;

  async function handleCopy() {
    if (!baseUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  }

  function handleDownload() {
    if (!svgRef.current) return;
    const safeName = (equipmentName ?? "equipment")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .slice(0, 80);
    downloadQrPng({
      svgElement: svgRef.current,
      fileName: `ppr-equipment-${safeName}.png`,
      eyebrow: objectName,
      title: equipmentName ?? "Оборудование ППР",
      subtitle: inventoryNo ? `Инв. ${inventoryNo}` : undefined,
      token: activeQr.qr_token,
    });
  }

  return (
    <div className="warehouse-qr-shell">
      <div className="warehouse-qr-layout">
        <div className="warehouse-qr-preview">
          <QRCodeSVG
            value={baseUrl ? qrUrl : qrHref}
            size={132}
            level="H"
            includeMargin
            ref={svgRef}
          />
          {objectName ? (
            <div className="warehouse-qr-preview-eyebrow">{objectName}</div>
          ) : null}
          <div className="warehouse-qr-preview-title">
            {equipmentName ?? "Оборудование ППР"}
          </div>
          {inventoryNo ? (
            <div
              className="text-soft"
              style={{ fontSize: "0.78rem", marginTop: "0.15rem", letterSpacing: "0.04em" }}
            >
              Инв. {inventoryNo}
            </div>
          ) : null}
        </div>

        <div className="warehouse-qr-content">
          <div className="warehouse-qr-meta">
            <div className="text-soft">Токен</div>
            <div className="warehouse-qr-token">{activeQr.qr_token}</div>
          </div>
          <div className="warehouse-qr-stats">
            <div className="warehouse-qr-stat">
              <div className="text-soft">Сгенерирован</div>
              <div>{new Date(activeQr.generated_at).toLocaleString("ru-RU")}</div>
            </div>
            <div className="warehouse-qr-stat">
              <div className="text-soft">Статус</div>
              <div>{activeQr.is_active ? "Активен" : "Неактивен"}</div>
            </div>
          </div>

          <div className="warehouse-qr-actions">
            <button type="button" className="btn btn-accent" onClick={handleDownload}>
              Скачать PNG
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleCopy}>
              {copied ? "Скопировано!" : "Копировать ссылку"}
            </button>
            <a
              href={qrHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost warehouse-qr-link"
            >
              Открыть ссылку
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
