const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function decodeAndValidateImage(image) {
  if (typeof image !== "string" || !image.trim()) {
    throw new Error("Please upload an image.");
  }

  const base64 = image.startsWith("data:")
    ? image.split(",")[1]
    : image;

  if (
    !base64 ||
    base64.length > Math.ceil(MAX_IMAGE_SIZE * 4 / 3) + 8 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw new Error("Invalid or oversized image.");
  }

  const buffer = Buffer.from(base64, "base64");

  if (
    !buffer.length ||
    buffer.length > MAX_IMAGE_SIZE ||
    buffer.toString("base64").replace(/=+$/, "") !==
      base64.replace(/=+$/, "")
  ) {
    throw new Error("Invalid image data or file size.");
  }

  const mimeType = detectImageType(buffer);

  if (!mimeType) {
    throw new Error("Upload a valid JPG, PNG or WebP image.");
  }

  return { buffer, base64, mimeType };
}

function detectImageType(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}