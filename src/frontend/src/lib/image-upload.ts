const MAX_DIMENSION = 1600;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be read."));
    };
    image.src = objectUrl;
  });
}

export async function optimizeImageFile(
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    format?: "image/jpeg" | "image/webp" | "image/png";
  },
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const image = await loadImage(file);
  const maxDimension = options?.maxDimension ?? MAX_DIMENSION;
  const quality = options?.quality ?? 0.86;
  const format =
    options?.format ??
    (file.type === "image/png" ? "image/png" : "image/jpeg");

  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), format, quality),
  );

  if (!blob || blob.size >= file.size) return file;

  const extension =
    format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${extension}`, {
    type: format,
    lastModified: Date.now(),
  });
}
