"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ALLOWED_MIME_TYPES, MAX_FILES_PER_UPLOAD, validateAttachmentFile } from "@/lib/attachments";

export type PickedFile = {
  file: File;
  previewUrl: string;
};

type PhotoPickerProps = {
  files: PickedFile[];
  onChange: (files: PickedFile[]) => void;
  disabled?: boolean;
  label?: string;
};

export function PhotoPicker({ files, onChange, disabled = false, label = "Прикрепить фото" }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Освобождаем object URLs при размонтировании
  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      setError(null);

      const newFiles = Array.from(incoming);
      const combined = [...files, ...newFiles];

      if (combined.length > MAX_FILES_PER_UPLOAD) {
        setError(`Максимум ${MAX_FILES_PER_UPLOAD} фото.`);
        return;
      }

      for (const file of newFiles) {
        const validationError = validateAttachmentFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      const pickedNew: PickedFile[] = newFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file)
      }));

      onChange([...files, ...pickedNew]);

      // Сбросить input, чтобы можно было выбрать те же файлы повторно
      if (inputRef.current) inputRef.current.value = "";
    },
    [files, onChange]
  );

  function removeFile(index: number) {
    const removed = files[index];
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(files.filter((_, i) => i !== index));
    setError(null);
  }

  const accept = ALLOWED_MIME_TYPES.join(",");

  return (
    <div className="photo-picker">
      {files.length > 0 && (
        <div className="photo-picker-previews">
          {files.map((f, i) => (
            <div key={f.previewUrl} className="photo-picker-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.previewUrl} alt={f.file.name} className="photo-picker-thumb-img" />
              <button
                type="button"
                className="photo-picker-thumb-remove"
                onClick={() => removeFile(i)}
                disabled={disabled}
                aria-label={`Удалить фото ${f.file.name}`}
              >
                ✕
              </button>
              <span className="photo-picker-thumb-name">{f.file.name}</span>
            </div>
          ))}
        </div>
      )}

      {files.length < MAX_FILES_PER_UPLOAD && (
        <button
          type="button"
          className="photo-picker-btn"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <span className="photo-picker-icon" aria-hidden="true">📎</span>
          {label}
          <span className="photo-picker-hint">
            (JPEG/PNG/WebP, до 5 MB, макс. {MAX_FILES_PER_UPLOAD} шт.)
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="photo-picker-input-hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      {error && (
        <div className="photo-picker-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
