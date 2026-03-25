function buildCompressionProfile(file, width, height) {
  const longestSide = Math.max(width, height);
  const megapixels = (width * height) / 1000000;

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

self.addEventListener("message", async (event) => {
  const file = event.data?.file;

  if (!file) {
    self.postMessage({ ok: false, error: "Worker did not receive a file." });
    return;
  }

  try {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
      throw new Error("Worker image processing is unsupported.");
    }

    const bitmap = await createImageBitmap(file);

    try {
      const profile = buildCompressionProfile(file, bitmap.width, bitmap.height);
      const scale = Math.min(1, profile.maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Worker canvas context is unavailable.");
      }

      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvas.convertToBlob({
        type: profile.targetType,
        quality: profile.targetType === "image/png" ? undefined : profile.quality,
      });

      self.postMessage({
        ok: true,
        blob,
        targetType: blob.type || profile.targetType,
      });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
