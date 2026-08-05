// Browser-only: downscales a photo before it's base64-encoded and sent to
// the server action, keeping payload size and Claude's per-image limits in
// check, and normalizes HEIC/whatever-the-camera-produced into JPEG.
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

export type ResizedImage = { mediaType: "image/jpeg"; data: string; previewUrl: string };

export async function resizeImageFile(file: File): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return {
    mediaType: "image/jpeg",
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    previewUrl: dataUrl,
  };
}
