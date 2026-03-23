"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoPicker, type PickedFile } from "@/components/tasks/photo-picker";
import { enqueueRoundsCheckin, loadRoundsScannerSnapshot, saveRoundsScannerSnapshot } from "@/lib/offline/rounds-queue";
import { compressRoundsPhoto } from "@/lib/rounds/client-photo";
import { toOperationalDate } from "@/lib/rounds/date";
import { extractRoundsToken } from "@/lib/rounds/token";
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

export function RoundsEntryForm({ token, userId }: Props) {
  const router = useRouter();
  const [room, setRoom] = useState<ResolvedRoom | null>(null);
  const [projectTimeZone, setProjectTimeZone] = useState("UTC");
  const [comment, setComment] = useState("");
  const [photoFiles, setPhotoFiles] = useState<PickedFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  const normalizedToken = useMemo(() => extractRoundsToken(token), [token]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const localSnapshot = await loadRoundsScannerSnapshot();
      if (cancelled) return;

      if (localSnapshot) {
        setProjectTimeZone(localSnapshot.projectTimeZone);
        const match = localSnapshot.rooms.find((item) => item.qr_token === normalizedToken) ?? null;
        if (match) setRoom(match);
      }

      if (!navigator.onLine) return;

      try {
        const response = await fetch("/api/rounds/config");
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              projectTimeZone?: string;
              scannerObjects?: Array<{ id: string; name: string }>;
              scannerRooms?: ResolvedRoom[];
            }
          | null;
        if (!payload?.ok || cancelled) return;

        const snapshot = {
          projectTimeZone: payload.projectTimeZone ?? "UTC",
          objects: payload.scannerObjects ?? [],
          rooms: payload.scannerRooms ?? [],
          updatedAt: new Date().toISOString(),
        };
        await saveRoundsScannerSnapshot(snapshot);
        if (cancelled) return;

        setProjectTimeZone(snapshot.projectTimeZone);
        setRoom(snapshot.rooms.find((item) => item.qr_token === normalizedToken) ?? null);
      } catch {
        // keep offline snapshot
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [normalizedToken]);

  function setInfo(nextMessage: string) {
    setMessage(nextMessage);
    setIsError(false);
  }

  function setError(nextMessage: string) {
    setMessage(nextMessage);
    setIsError(true);
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Не удалось сохранить отметку обхода.");
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
            <strong>Помещение не найдено</strong>
            <div className="text-soft">
              Не удалось разрешить QR-токен. Если вы офлайн, сначала откройте `Обходы` онлайн, чтобы кэшировать конфигурацию.
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
