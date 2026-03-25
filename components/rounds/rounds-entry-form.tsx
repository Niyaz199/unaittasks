"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoPicker, type PickedFile } from "@/components/tasks/photo-picker";
import { enqueueRoundsCheckin } from "@/lib/offline/rounds-queue";
import { compressRoundsPhoto } from "@/lib/rounds/client-photo";
import { toOperationalDate } from "@/lib/rounds/date";
import { extractRoundsToken } from "@/lib/rounds/token";
import { useRoundsScannerConfig } from "@/components/rounds/rounds-scanner-config-provider";
import { RoundsSyncStatus } from "@/components/rounds/rounds-sync-status";

type Props = {
  token: string;
  userId: string;
};

type ResolvedRoom = {
  room_id: string;
  object_id: string;
  object_name: string;
  room_name: string;
  floor_name: string;
  qr_token: string;
};

type ApiErrorPayload = {
  error?: string;
  details?: string | Record<string, unknown> | null;
  hint?: string | null;
};

type LookupState = "unknown" | "enabled" | "disabled" | "inactive" | "configured" | "invalid";

type ResolveTokenPayload = {
  ok?: boolean;
  state?: LookupState;
  room?: ResolvedRoom | null;
  error?: string;
};

export function RoundsEntryForm({ token, userId }: Props) {
  const router = useRouter();
  const { snapshot, isLoading } = useRoundsScannerConfig();
  const [room, setRoom] = useState<ResolvedRoom | null>(null);
  const [projectTimeZone, setProjectTimeZone] = useState("UTC");
  const [comment, setComment] = useState("");
  const [photoFiles, setPhotoFiles] = useState<PickedFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [lookupState, setLookupState] = useState<LookupState>("unknown");
  const [pending, startTransition] = useTransition();

  const normalizedToken = useMemo(() => extractRoundsToken(token), [token]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLookupState("unknown");
      setRoom(null);

      if (snapshot) {
        setProjectTimeZone(snapshot.projectTimeZone);
        const match = snapshot.rooms.find((item) => item.qr_token === normalizedToken) ?? null;
        if (match) {
          setRoom(match);
          setLookupState("enabled");
          return;
        }
      }

      if (isLoading || !navigator.onLine) return;

      try {
        const resolveResponse = await fetch(`/api/rounds/resolve/${encodeURIComponent(normalizedToken)}`);
        const resolvePayload = (await resolveResponse.json().catch(() => null)) as ResolveTokenPayload | null;
        if (cancelled) return;

        if (resolveResponse.ok && resolvePayload?.ok && resolvePayload.room) {
          setRoom(resolvePayload.room);
          setLookupState("enabled");
          return;
        }

        setRoom(null);
        setLookupState(resolvePayload?.state ?? "invalid");
      } catch {
        // Keep shared snapshot result when fallback resolve fails.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoading, normalizedToken, snapshot]);

  function setInfo(nextMessage: string) {
    setMessage(nextMessage);
    setIsError(false);
  }

  function setError(nextMessage: string) {
    setMessage(nextMessage);
    setIsError(true);
  }

  async function readApiError(response: Response, fallback: string) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    if (payload?.error?.trim()) return payload.error.trim();
    if (payload?.hint?.trim()) return payload.hint.trim();
    return fallback;
  }

  async function persistOffline(input?: {
    scannedAtDevice: string;
    clientEventId: string;
    compressedFile: File | null;
  }) {
    if (!room) {
      setError("Помещение не найдено в локальной конфигурации.");
      return;
    }

    const scannedAtDevice = input?.scannedAtDevice ?? new Date().toISOString();
    const compressedFile = input?.compressedFile ?? (photoFiles[0] ? await compressRoundsPhoto(photoFiles[0].file) : null);
    const clientEventId = input?.clientEventId ?? crypto.randomUUID();
    await enqueueRoundsCheckin({
      clientEventId,
      roomId: room.room_id,
      objectId: room.object_id,
      roomQrToken: room.qr_token,
      scannedAtDevice,
      operationalDate: toOperationalDate(scannedAtDevice, projectTimeZone),
      userId,
      comment: comment.trim(),
      photo: compressedFile
        ? {
            blob: compressedFile,
            fileName: compressedFile.name,
            mimeType: compressedFile.type,
            sizeBytes: compressedFile.size,
          }
        : null,
    });
    setInfo("Отметка сохранена локально и будет отправлена при появлении интернета.");
    setComment("");
    setPhotoFiles([]);
    window.setTimeout(() => router.replace("/rounds/scan"), 900);
  }

  async function persistOnline() {
    if (!room) {
      setError("Помещение не найдено.");
      return;
    }

    const scannedAtDevice = new Date().toISOString();
    const clientEventId = crypto.randomUUID();
    const compressedFile = photoFiles[0] ? await compressRoundsPhoto(photoFiles[0].file) : null;
    const formData = new FormData();
    formData.set("room_id", room.room_id);
    formData.set("client_event_id", clientEventId);
    formData.set("scanned_at_device", scannedAtDevice);
    formData.set("comment", comment.trim());
    formData.set("source", "pwa");
    if (compressedFile) {
      formData.append("photo", compressedFile);
    }

    try {
      const response = await fetch("/api/rounds/checkins", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const fallback =
          response.status === 400
            ? "Отметку обхода не удалось сохранить. Проверьте помещение и повторите попытку."
            : "Не удалось сохранить отметку обхода.";
        const message = await readApiError(response, fallback);
        setError(
          message === "Помещение не включено в обходы"
            ? "Помещение найдено по QR, но сейчас не включено в обходы. Обратитесь к конфигуратору обходов."
            : message
        );
        return;
      }

      setInfo("Отметка сохранена и синхронизирована.");
      setComment("");
      setPhotoFiles([]);
      window.setTimeout(() => router.replace("/rounds/scan"), 900);
    } catch {
      await persistOffline({ scannedAtDevice, clientEventId, compressedFile });
    }
  }

  function handleSubmit() {
    setMessage(null);
    startTransition(async () => {
      if (!navigator.onLine) {
        await persistOffline();
        return;
      }
      await persistOnline();
    });
  }

  return (
    <div className="grid">
      <RoundsSyncStatus />

      <div className="section-card grid" style={{ gap: "0.9rem" }}>
        {room ? (
          <>
            <div className="grid" style={{ gap: "0.35rem" }}>
              <strong>Подтверждение помещения</strong>
              <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>{room.room_name}</div>
              <div className="text-soft">{room.object_name} • {room.floor_name}</div>
            </div>

            <textarea
              className="input"
              rows={4}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Комментарий, если есть замечание"
              disabled={pending}
            />

            <PhotoPicker
              files={photoFiles}
              onChange={(files) => setPhotoFiles(files.slice(0, 1))}
              disabled={pending}
              label="Добавить фото"
            />

            <div className="row" style={{ flexWrap: "wrap" }}>
              <button className="btn btn-accent" type="button" onClick={handleSubmit} disabled={pending}>
                {pending ? "Сохранение..." : "Подтвердить отметку"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => router.replace("/rounds/scan")} disabled={pending}>
                Назад к сканеру
              </button>
            </div>
          </>
        ) : (
          <div className="grid" style={{ gap: "0.45rem" }}>
            <strong>
              {lookupState === "disabled"
                ? "Помещение выключено из обходов"
                : lookupState === "inactive"
                  ? "Помещение недоступно"
                  : lookupState === "configured"
                    ? "Конфигурация обходов не обновилась"
                    : "Помещение не найдено"}
            </strong>
            <div className="text-soft">
              {lookupState === "disabled"
                ? "QR помещения найден, но помещение сейчас не включено в обходы."
                : lookupState === "inactive"
                  ? "QR помещения найден, но само помещение сейчас неактивно."
                  : lookupState === "configured"
                    ? "QR помещения найден и помещение отмечено в обходах, но сканер пока не получил актуальную конфигурацию. Откройте конфигуратор, сохраните конфигурацию ещё раз и перезагрузите экран обходов."
                    : "Не удалось разрешить QR-токен. Если вы офлайн, сначала откройте `Обходы` онлайн, чтобы кэшировать конфигурацию."}
            </div>
            <div className="row">
              <button className="btn btn-ghost" type="button" onClick={() => router.replace("/rounds/scan")}>
                К сканеру
              </button>
            </div>
          </div>
        )}

        {message ? (
          <div className="text-soft" style={isError ? { color: "var(--danger)" } : undefined}>
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
