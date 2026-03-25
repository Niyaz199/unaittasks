"use client";

export type PreparedRoundsPhoto = {
  file: File;
  strategy: "worker" | "main-thread" | "passthrough";
  didFallback: boolean;
};

type CompressOptions = {
  signal?: AbortSignal;
};

type CompressionProfile = {
  maxSide: number;
  quality: number;
  targetType: string;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

const WORKER_URL = "/rounds-photo-worker.js";

function createAbortError() {
  return new DOMException("Photo processing aborted", "AbortError");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : createAbortError();
  }
}

async function yieldToBrowser() {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

function buildCompressionProfile(file: File, width: number, height: number): CompressionProfile {
  const longestSide = Math.max(width, height);
  const megapixels = (width * height) / 1_000_000;

  let maxSide = 1600;
  let quality = 0.82;

  if (file.size > 4 * 1024 * 1024 || megapixels > 8 || longestSide > 3000) {
    maxSide = 1280;
    quality = 0.74;
  } else if (file.size > 2.5 * 1024 * 1024 || megapixels > 5 || longestSide > 2200) {
    maxSide = 1440;
    quality = 0.78;
  }

  return {
    maxSide,
    quality,
    targetType: file.type === "image/png" ? "image/png" : "image/jpeg",
  };
}

function createPreparedFile(file: File, blob: Blob) {
  const targetType = blob.type || file.type;
  const extension = targetType === "image/png" ? "png" : "jpg";
  return new File([blob], `rounds-photo-${crypto.randomUUID()}.${extension}`, {
    type: targetType,
    lastModified: Date.now(),
  });
}

async function decodeImageOnMainThread(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Не удалось декодировать изображение."));
      });
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  return {
    source: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    release: () => URL.revokeObjectURL(objectUrl),
  };
}

async function compressOnMainThread(file: File, options: CompressOptions = {}): Promise<PreparedRoundsPhoto> {
  const { signal } = options;

  throwIfAborted(signal);
  await yieldToBrowser();
  const decoded = await decodeImageOnMainThread(file);

  try {
    throwIfAborted(signal);
    const profile = buildCompressionProfile(file, decoded.width, decoded.height);
    const scale = Math.min(1, profile.maxSide / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return { file, strategy: "passthrough", didFallback: true };
    }

    await yieldToBrowser();
    throwIfAborted(signal);
    context.drawImage(decoded.source, 0, 0, width, height);

    await yieldToBrowser();
    throwIfAborted(signal);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, profile.targetType, profile.targetType === "image/png" ? undefined : profile.quality);
    });

    if (!blob) {
      return { file, strategy: "passthrough", didFallback: true };
    }

    return {
      file: createPreparedFile(file, blob),
      strategy: "main-thread",
      didFallback: false,
    };
  } finally {
    decoded.release();
  }
}

async function compressInWorker(file: File, options: CompressOptions = {}): Promise<PreparedRoundsPhoto> {
  const { signal } = options;

  if (typeof Worker === "undefined") {
    throw new Error("Worker photo processing is unavailable.");
  }

  throwIfAborted(signal);

  return new Promise<PreparedRoundsPhoto>((resolve, reject) => {
    const worker = new Worker(WORKER_URL);
    let settled = false;

    function cleanup() {
      worker.terminate();
      if (signal) {
        signal.removeEventListener("abort", handleAbort);
      }
    }

    function finishWith(result: PreparedRoundsPhoto) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function failWith(error: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    function handleAbort() {
      failWith(createAbortError());
    }

    worker.onmessage = (event: MessageEvent<{ ok: boolean; blob?: Blob; targetType?: string; error?: string }>) => {
      if (!event.data?.ok || !event.data.blob) {
        failWith(new Error(event.data?.error ?? "Worker compression failed."));
        return;
      }

      const preparedFile = createPreparedFile(file, event.data.blob);

      finishWith({
        file: preparedFile,
        strategy: "worker",
        didFallback: false,
      });
    };

    worker.onerror = () => {
      failWith(new Error("Worker compression failed."));
    };

    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    worker.postMessage({ file });
  });
}

export async function prepareRoundsPhoto(file: File, options: CompressOptions = {}): Promise<PreparedRoundsPhoto> {
  if (typeof window === "undefined") {
    return { file, strategy: "passthrough", didFallback: true };
  }

  if (!file.type.startsWith("image/")) {
    return { file, strategy: "passthrough", didFallback: true };
  }

  try {
    return await compressInWorker(file, options);
  } catch (workerError) {
    if (isAbortError(workerError)) throw workerError;

    try {
      const result = await compressOnMainThread(file, options);
      return {
        ...result,
        didFallback: true,
      };
    } catch (fallbackError) {
      if (isAbortError(fallbackError)) throw fallbackError;
      return { file, strategy: "passthrough", didFallback: true };
    }
  }
}

export async function compressRoundsPhoto(file: File, options: CompressOptions = {}) {
  const result = await prepareRoundsPhoto(file, options);
  return result.file;
}
