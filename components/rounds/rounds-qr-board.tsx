"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { RoundsConfigRoom } from "@/lib/rounds/types";
import { downloadQrPng } from "@/lib/qr/export";

export function RoundsQrBoard({ rooms }: { rooms: RoundsConfigRoom[] }) {
  const [baseUrl, setBaseUrl] = useState("");
  const svgRefs = useRef<Record<string, SVGSVGElement | null>>({});

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  function downloadRoomPng(room: RoundsConfigRoom) {
    const svg = svgRefs.current[room.id];
    if (!svg || !room.room_qr_token) return;
    downloadQrPng({
      svgElement: svg,
      fileName: `room-${room.room_name}.png`,
      title: room.room_name,
      subtitle: `${room.object_name} • ${room.floor_name}`,
      token: room.room_qr_token,
    });
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="text-soft">Под каждым QR выводится название помещения. Можно печатать страницу браузером или скачать PNG поштучно.</div>
        <button className="btn btn-ghost" type="button" onClick={() => window.print()}>
          Печать
        </button>
      </div>

      <div className="mobile-cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {rooms.map((room) => {
          if (!room.room_qr_token) return null;
          const href = `/ppr/rooms/qr/${room.room_qr_token}`;
          const url = `${baseUrl}${href}`;
          return (
            <div key={room.id} className="section-card grid" style={{ gap: "0.75rem" }}>
              <div className="grid" style={{ gap: "0.2rem" }}>
                <strong>{room.room_name}</strong>
                <div className="text-soft">{room.object_name} • {room.floor_name}</div>
              </div>
              <div
                style={{
                  background: "#fff",
                  padding: "0.75rem",
                  borderRadius: "12px",
                  width: "fit-content",
                  display: "grid",
                  gap: "0.55rem",
                  justifyItems: "center",
                }}
              >
                <QRCodeSVG
                  value={baseUrl ? url : href}
                  size={180}
                  includeMargin
                  level="H"
                  ref={(element) => {
                    svgRefs.current[room.id] = element;
                  }}
                />
                <div style={{ color: "#111827", fontWeight: 600, maxWidth: "180px", textAlign: "center", lineHeight: 1.35 }}>
                  {room.room_name}
                </div>
              </div>
              <div className="text-soft" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                {room.room_qr_token}
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-ghost" type="button" onClick={() => downloadRoomPng(room)}>
                  Скачать PNG
                </button>
                <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
                  Открыть
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
