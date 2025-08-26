// utils/uploadImgBB.js
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

export async function uploadToImgBB(filePath) {
  const form = new FormData();
  form.append("image", fs.createReadStream(filePath));
  form.append("key", process.env.IMGBB_API_KEY);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: form,
  });

  const data = await response.json();
  fs.unlink(filePath, () => {}); // delete temp file

  if (!data.success) {
    throw new Error("ImgBB upload failed: " + JSON.stringify(data));
  }

  return data.data.url; // HTTPS ready URL
}
