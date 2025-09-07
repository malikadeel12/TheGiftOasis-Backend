// utils/uploadCloudinary.js
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Cloudinary config (env variables use karo)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(filePath, folder = "gift-shop", options = {}) {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary environment variables missing");
  }

  try {
    // Use resource_type: 'auto' so both images and videos are supported
    const result = await cloudinary.uploader.upload(filePath, { resource_type: "auto", folder, ...options });
    return result.secure_url;
  } catch (err) {
    throw new Error("Cloudinary upload failed: " + err.message);
  } finally {
    // Temp file cleanup
    fs.unlink(filePath, () => {});
  }
}
