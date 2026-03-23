"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { RoundsConfigRoom } from "@/lib/rounds/types";

export function RoundsQrBoard({ rooms }: { rooms: RoundsConfigRoom[] }) {
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  function downloadSvg(containerId: string, fileName: string) {
    const svg = document.getElementById(containerId)?.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const image = new Image();
    const size = 1200;
    canvas.width = size;
    canvas.height = size;

    image.onload = () => {
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="text-soft">Рядом с QR выводятся объект и помещение. Можно печатать страницу браузером или скачать PNG поштучно.</div>
        <button className="btn btn-ghost" type="button" onClick={() => window.print()}>
          Печать
        </button>
      </div>

      <div className="mobile-cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {rooms.map((room) => {
          const url = `${baseUrl}/rounds/scan?token=${encodeURIComponent(room.rounds_qr_token ?? "")}`;
          const containerId = `rounds-qr-${room.id}`;
          return (
            <div key={room.id} className="section-card grid" style={{ gap: "0.75rem" }}>
              <div className="grid" style={{ gap: "0.2rem" }}>
                <strong>{room.room_name}</strong>
                <div className="text-soft">{room.object_name} • {room.floor_name}</div>
              </div>
              <div id={containerId} style={{ background: "#fff", padding: "0.6rem", borderRadius: "12px", width: "fit-content" }}>
                <QRCodeSVG value={baseUrl ? url : `/rounds/entry/${room.rounds_qr_token}`} size={180} includeMargin level="H" />
              </div>
              <div className="text-soft" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                {room.rounds_qr_token}
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-ghost" type="button" onClick={() => downloadSvg(containerId, `rounds-${room.room_name}.png`)}>
                  Скачать PNG
                </button>
                <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
                  Открыть deep-link
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
