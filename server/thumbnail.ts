import sharp from "sharp";

const THUMBNAIL_SIZE = 80;
const THUMBNAIL_QUALITY = 60;

export async function generateThumbnail(base64ImageUrl: string): Promise<string> {
  const matches = base64ImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid base64 image format");
  }

  const imageBuffer = Buffer.from(matches[2], "base64");

  const thumbnailBuffer = await sharp(imageBuffer)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return `data:image/jpeg;base64,${thumbnailBuffer.toString("base64")}`;
}
