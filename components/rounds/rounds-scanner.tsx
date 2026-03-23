"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadRoundsScannerSnapshot, saveRoundsScannerSnapshot } from "@/lib/offline/rounds-queue";
import { extractRoundsToken } from "@/lib/rounds/token";
import { RoundsSyncStatus } from "@/components/rounds/rounds-sync-status";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

export function RoundsScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const timerRef = useRef<number | null>(null);

  const [manualValue, setManualValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDetectorAvailable, setIsDetectorAvailable] = useState(false);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  }, []);

  const openToken = useCallback((rawToken: string) => {
    const token = extractRoundsToken(rawToken);
    if (!token) {
      setMessage("Не удалось распознать QR-код помещения.");
      return;
    }
    stopCamera();
    router.push(`/rounds/scan?token=${encodeURIComponent(token)}`);
  }, [router, stopCamera]);

  const scanFrame = useCallback(async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!detector || !video || video.readyState < 2) {
      timerRef.current = window.setTimeout(() => void scanFrame(), 700);
      return;
    }

    try {
      const codes = await detector.detect(video);
      const rawValue = codes[0]?.rawValue;
      if (rawValue) {
        openToken(rawValue);
        return;
      }
    } catch {
      // ignore and retry
    }

    timerRef.current = window.setTimeout(() => void scanFrame(), 700);
  }, [openToken]);

  const startCamera = useCallback(async () => {
    if (!window.BarcodeDetector) {
      setMessage("На этом устройстве нет встроенного BarcodeDetector. Используйте deep-link или ручной ввод токена.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });
      streamRef.current = stream;
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      setIsDetectorAvailable(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setMessage(null);
      setIsCameraActive(true);
      await scanFrame();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось открыть камеру.");
      stopCamera();
    }
  }, [scanFrame, stopCamera]);

  useEffect(() => {
    setIsDetectorAvailable(Boolean(window.BarcodeDetector));
    void loadRoundsScannerSnapshot().then((snapshot) => {
      if (snapshot) setSnapshotUpdatedAt(snapshot.updatedAt);
    });

    if (navigator.onLine) {
      void fetch("/api/rounds/config")
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (!payload?.ok) return;
          const snapshot = {
            projectTimeZone: payload.projectTimeZone,
            objects: payload.scannerObjects,
            rooms: payload.scannerRooms,
            updatedAt: new Date().toISOString(),
          };
          setSnapshotUpdatedAt(snapshot.updatedAt);
          return saveRoundsScannerSnapshot(snapshot);
        })
        .catch(() => null);
    }

    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="grid">
      <RoundsSyncStatus />

      <div className="section-card grid" style={{ gap: "1rem" }}>
        <div className="grid" style={{ gap: "0.35rem" }}>
          <strong>Сканер помещения</strong>
          <div className="text-soft">
            Сценарий техника: scan → подтвердить помещение → комментарий/фото по необходимости → сохранить → следующий QR.
          </div>
          {snapshotUpdatedAt ? (
            <div className="text-soft">Локальная конфигурация обновлена: {new Date(snapshotUpdatedAt).toLocaleString("ru-RU")}</div>
          ) : (
            <div className="text-soft">Локальная конфигурация пока не кэширована. Для первого запуска нужен интернет.</div>
          )}
        </div>

        <div className="grid" style={{ gap: "0.75rem" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            className="rounds-scanner-video"
            style={{
              width: "100%",
              minHeight: "260px",
              borderRadius: "12px",
              background: "#06111f",
              objectFit: "cover",
            }}
          />

          <div className="row" style={{ flexWrap: "wrap" }}>
            {!isCameraActive ? (
              <button className="btn btn-accent" type="button" onClick={() => void startCamera()}>
                Открыть камеру
              </button>
            ) : (
              <button className="btn btn-ghost" type="button" onClick={stopCamera}>
                Остановить камеру
              </button>
            )}
            {!isDetectorAvailable ? <span className="text-soft">Встроенный сканер недоступен на этом устройстве.</span> : null}
          </div>
        </div>

        <div className="grid" style={{ gap: "0.6rem" }}>
          <div className="text-soft">Ручной ввод / deep-link fallback</div>
          <div className="row" style={{ alignItems: "stretch" }}>
            <input
              className="input"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="Вставьте token или URL из QR"
            />
            <button className="btn btn-ghost" type="button" onClick={() => openToken(manualValue)}>
              Открыть
            </button>
          </div>
        </div>

        {message ? <div className="text-soft">{message}</div> : null}
      </div>
    </div>
  );
}
