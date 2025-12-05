import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import connectDB from "./config/db.js";
import { fileURLToPath } from "url";
import path from "path";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import multer from "multer";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ------------------ CORS ------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://the-gift-oasis-frontend.vercel.app",
  "https://the-gift-oasis-frontend-o8py.vercel.app" ,
  "https://thegiftoasis.store",
  "https://www.thegiftoasis.store"


];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ------------------ Parsers ------------------
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ------------------ Cloudinary Config (for checkout screenshots only) ------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------ Multer (temp storage) ------------------
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only images allowed"), ok);
  },
});

// ------------------ Health check ------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ------------------ Checkout Screenshot Upload (Cloudinary) ------------------
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "orders/screenshots",
      resource_type: "image",
    });

    fs.unlink(req.file.path, () => {}); // delete temp file

    return res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// ------------------ Routes ------------------
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/blog", blogRoutes);


// ------------------ Start Server ------------------
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
