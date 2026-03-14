"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

type ActiveQrCode = {
  qr_token: string;
  generated_at: string;
  is_active: boolean;
};

export function PprEquipmentQrBlock({ qrCode }: { qrCode: ActiveQrCode | null }) {
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

  const qrUrl = baseUrl ? `${baseUrl}/ppr/qr/${qrCode.qr_token}` : `/ppr/qr/${qrCode.qr_token}`;

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
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    // Scale up for better resolution
    const size = 1000;
    canvas.width = size;
    canvas.height = size;
    
    img.onload = () => {
      if (!ctx) return;
      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${qrCode?.qr_token}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: "1.5rem", flexWrap: "wrap" }}>
        
        {/* QR Code Graphic */}
        <div style={{ padding: "0.5rem", background: "#fff", borderRadius: "12px", width: "max-content" }}>
          <QRCodeSVG 
            value={baseUrl ? qrUrl : `https://example.com/ppr/qr/${qrCode.qr_token}`}
            size={160}
            level="H"
            includeMargin={true}
            ref={svgRef}
          />
        </div>

        {/* QR Data & Actions */}
        <div className="grid" style={{ gap: "0.75rem", flex: 1, minWidth: "200px" }}>
          <div>
            <div className="text-soft">Токен</div>
            <div style={{ fontFamily: "monospace", fontSize: "1.05rem" }}>{qrCode.qr_token}</div>
          </div>
          <div className="row" style={{ gap: "1rem" }}>
            <div>
              <div className="text-soft">Сгенерирован</div>
              <div>{new Date(qrCode.generated_at).toLocaleString("ru-RU")}</div>
            </div>
            <div>
              <div className="text-soft">Статус</div>
              <div>{qrCode.is_active ? "Активен" : "Неактивен"}</div>
            </div>
          </div>

          <div className="row" style={{ gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={handleCopy}>
              {copied ? "Скопировано!" : "Копировать ссылку"}
            </button>
            <a 
              href={`/ppr/qr/${qrCode.qr_token}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-ghost"
              style={{ textDecoration: "none" }}
            >
              Открыть
            </a>
            <button type="button" className="btn btn-ghost" onClick={handleDownload}>
              Скачать PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
