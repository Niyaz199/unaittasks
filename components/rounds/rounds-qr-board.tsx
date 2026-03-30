"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { RoundsConfigRoom, RoundsObjectOption } from "@/lib/rounds/types";
import { downloadQrPng } from "@/lib/qr/export";

type Props = {
  rooms: RoundsConfigRoom[];
  objects: RoundsObjectOption[];
  floorOptions: string[];
  selectedObjectId: string;
  selectedFloorName: string;
};

export function RoundsQrBoard({ rooms, objects, floorOptions, selectedObjectId, selectedFloorName }: Props) {
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
      eyebrow: `${room.object_name} • ${room.floor_name}`,
      title: room.room_name,
    });
  }

  return (
    <>
      <div className="grid rounds-qr-layout" style={{ gap: "1rem" }}>
        <form
          className="section-card filters-grid rounds-qr-toolbar rounds-qr-screen-only"
          method="get"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}
        >
          <select className="select" name="object" defaultValue={selectedObjectId}>
            <option value="">Все объекты</option>
            {objects.map((objectItem) => (
              <option key={objectItem.id} value={objectItem.id}>
                {objectItem.name}
              </option>
            ))}
          </select>
          <select className="select" name="floor" defaultValue={selectedFloorName}>
            <option value="">Все этажи</option>
            {floorOptions.map((floorName) => (
              <option key={floorName} value={floorName}>
                {floorName}
              </option>
            ))}
          </select>
          <button className="btn btn-accent" type="submit">
            Применить
          </button>
          <a className="btn btn-ghost" href="/rounds/qr">
            Сбросить
          </a>
          <button className="btn btn-ghost" type="button" onClick={() => window.print()}>
            Печать
          </button>
        </form>

        <div className="text-soft rounds-qr-screen-only">
          Для печати лучше читается подпись в формате: объект и этаж над названием помещения. Сейчас в выборке: {rooms.length}.
        </div>

        {rooms.length === 0 ? (
          <div className="section-card text-soft">По текущим фильтрам не найдено помещений с активным QR для печати.</div>
        ) : null}

        <div className="mobile-cards rounds-qr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {rooms.map((room) => {
            if (!room.room_qr_token) return null;
            const href = `/ppr/rooms/qr/${room.room_qr_token}`;
            const url = `${baseUrl}${href}`;
            return (
              <article key={room.id} className="section-card rounds-qr-card">
                <div className="rounds-qr-visual">
                  <QRCodeSVG
                    value={baseUrl ? url : href}
                    size={180}
                    includeMargin
                    level="H"
                    ref={(element) => {
                      svgRefs.current[room.id] = element;
                    }}
                  />
                  <div className="rounds-qr-eyebrow">
                    {room.object_name} • {room.floor_name}
                  </div>
                  <div className="rounds-qr-title">{room.room_name}</div>
                </div>
                <div className="row rounds-qr-actions rounds-qr-screen-only" style={{ flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" type="button" onClick={() => downloadRoomPng(room)}>
                    Скачать PNG
                  </button>
                  <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
                    Открыть
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        .rounds-qr-card {
          display: grid;
          gap: 0.75rem;
          justify-items: center;
        }

        .rounds-qr-visual {
          background: #fff;
          padding: 0.85rem;
          border-radius: 12px;
          width: 100%;
          display: grid;
          gap: 0.45rem;
          justify-items: center;
        }

        .rounds-qr-eyebrow {
          color: #4b5563;
          font-size: 0.85rem;
          font-weight: 500;
          max-width: 220px;
          text-align: center;
          line-height: 1.35;
        }

        .rounds-qr-title {
          color: #111827;
          font-weight: 700;
          max-width: 220px;
          text-align: center;
          line-height: 1.35;
        }
      `}</style>
      <style jsx global>{`
        @media print {
          :root {
            color-scheme: light;
          }

          html,
          body {
            background: #fff !important;
            color: #111827 !important;
          }

          .admin-sidebar,
          .admin-topbar,
          .mobile-tabs,
          .mobile-module-launcher,
          .page-header,
          .rounds-qr-screen-only {
            display: none !important;
          }

          .admin-page {
            max-width: none !important;
            padding: 0 !important;
          }

          .rounds-qr-layout,
          .rounds-qr-grid {
            gap: 12mm !important;
          }

          .rounds-qr-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .rounds-qr-card {
            break-inside: avoid;
            page-break-inside: avoid;
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .rounds-qr-visual {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
