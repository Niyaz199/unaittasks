"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractRoundsToken } from "@/lib/rounds/token";
import { useRoundsScannerConfig } from "@/components/rounds/rounds-scanner-config-provider";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const timerRef = useRef<number | null>(null);
  const { snapshot } = useRoundsScannerConfig();

  const [message, setMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannerMode, setScannerMode] = useState<"native" | "fallback" | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    detectorRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setScannerMode(null);
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

  const scanWithBarcodeDetector = useCallback(async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!detector || !video || video.readyState < 2) {
      timerRef.current = window.setTimeout(() => void scanWithBarcodeDetector(), 500);
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

    timerRef.current = window.setTimeout(() => void scanWithBarcodeDetector(), 500);
  }, [openToken]);

  const scanWithFallback = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      timerRef.current = window.setTimeout(() => scanWithFallback(), 250);
      return;
    }

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      setMessage("Не удалось инициализировать QR-сканер.");
      stopCamera();
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(image.data, image.width, image.height);
    if (code?.data) {
      openToken(code.data);
      return;
    }

    timerRef.current = window.setTimeout(() => scanWithFallback(), 250);
  }, [openToken, stopCamera]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Браузер не поддерживает доступ к камере.");
      return;
    }

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (window.BarcodeDetector) {
        try {
          detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
          setScannerMode("native");
        } catch {
          detectorRef.current = null;
          setScannerMode("fallback");
        }
      } else {
        setScannerMode("fallback");
      }

      setMessage(null);
      setIsCameraActive(true);

      if (detectorRef.current) {
        await scanWithBarcodeDetector();
      } else {
        scanWithFallback();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось открыть камеру.");
      stopCamera();
    }
  }, [scanWithBarcodeDetector, scanWithFallback, stopCamera]);

  useEffect(() => {
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
          {snapshot?.updatedAt ? (
            <div className="text-soft">Локальная конфигурация обновлена: {new Date(snapshot.updatedAt).toLocaleString("ru-RU")}</div>
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
          <canvas ref={canvasRef} style={{ display: "none" }} />

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
            {isCameraActive && scannerMode === "fallback" ? <span className="text-soft">Используется совместимый QR-сканер.</span> : null}
          </div>
        </div>

        {message ? <div className="text-soft">{message}</div> : null}
      </div>
    </div>
  );
}
