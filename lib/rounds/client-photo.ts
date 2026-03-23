"use client";

export async function compressRoundsPhoto(file: File) {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const imageBitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    imageBitmap.close();
    return file;
  }

  context.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", 0.82);
  });
  if (!blob) return file;

  const targetType = blob.type || file.type;
  const extension = targetType === "image/png" ? "png" : "jpg";
  return new File([blob], `rounds-photo-${crypto.randomUUID()}.${extension}`, {
    type: targetType,
    lastModified: Date.now(),
  });
}
