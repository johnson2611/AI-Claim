export interface PreparedImage {
  data: string; // base64, no data: prefix
  mimeType: "image/jpeg";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Shrinks a photo before any model sees it. This keeps on-device requests inside the model's token limit
 * and, because the image is redrawn, also removes hidden metadata such as GPS location.
 */
export async function prepareImage(blob: Blob, maxSide = 896): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the image");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare the image"))), "image/jpeg", 0.8),
  );
  return { data: await blobToBase64(out), mimeType: "image/jpeg" };
}
