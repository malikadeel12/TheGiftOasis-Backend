import express from "express";
import multer from "multer";
import Product from "../models/Product.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";
import moment from "moment-timezone";
import { uploadToCloudinary } from "../utils/uploadCloudinary.js";

const router = express.Router();

// ===== Multer Config =====
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // allow videos up to 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      // images
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      // videos
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
    ];
    const ok = allowed.includes(file.mimetype);
    cb(ok ? null : new Error("Only images or videos allowed"), ok);
  },
});

// ===== Helper: Discount Logic =====
function getDiscountInfo(product) {
  const now = moment().tz("Asia/Karachi");
  let discountActive = false;
  let discountExpiry = null;

  if (product.discountPercentage > 0 && product.discountStart && product.discountEnd) {
    const discountStart = moment(product.discountStart).tz("Asia/Karachi");
    const discountEnd = moment(product.discountEnd).tz("Asia/Karachi");

    discountActive = now.isBetween(discountStart, discountEnd, null, "[]");
    // Send ISO so frontend can localize precisely without double converting
    discountExpiry = discountEnd.toISOString();
  }

  return {
    discountActive,
    discountExpiry,
    finalPrice: discountActive ? product.getFinalPrice() : product.price,
    discountPercentage: product.discountPercentage || 0,
  };
}

// ===== Admin Dashboard (All Products) =====
router.get("/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const updatedProducts = products.map((p) => {
      const { discountActive, discountExpiry, finalPrice, discountPercentage } = getDiscountInfo(p);

      return {
        ...p._doc,
        imageUrl: p.imageUrl,
        discountPercentage: discountActive ? discountPercentage : 0,
        discountStart: discountActive ? p.discountStart : null,
        discountEnd: discountActive ? p.discountEnd : null,
        finalPrice,
        discountExpiry,
        isDiscountActive: discountActive,
      };
    });

    res.json({ products: updatedProducts });
  } catch (err) {
    console.error("❌ Dashboard fetch error:", err);
    res.status(500).json({ message: "Error fetching products" });
  }
});

// ===== Add Product =====
router.post("/add-product", verifyToken, isAdmin, upload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]), async (req, res) => {
  try {
    const { name, description, price, category, discountPercentage, discountStart, discountEnd } = req.body;

    if (!name || !description || !price || !category) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) return res.status(400).json({ message: "Invalid price" });

    let imageUrl = "";
    let videoUrl = "";
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      imageUrl = await uploadToCloudinary(imageFile.path, "products/images");
    }
    if (videoFile) {
      videoUrl = await uploadToCloudinary(videoFile.path, "products/videos", { resource_type: "auto" });
    }

    const discountStartDate = discountStart
      ? moment.tz(discountStart, "Asia/Karachi").toISOString()
      : null;
    const discountEndDate = discountEnd
      ? moment.tz(discountEnd, "Asia/Karachi").toISOString()
      : null;

    const product = new Product({
      name,
      description,
      price: priceNum,
      category,
      discountPercentage: Number(discountPercentage || 0),
      discountStart: discountStartDate,
      discountEnd: discountEndDate,
      imageUrl,
      videoUrl,
    });

    await product.save();
    res.json({ message: "✅ Product added successfully", product });
  } catch (err) {
    console.error("❌ Add product error:", err);
    res.status(500).json({ message: "Error adding product", error: err.message });
  }
});

// ===== Update Product =====
router.put("/update-product/:id", verifyToken, isAdmin, upload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]), async (req, res) => {
  try {
    const { name, description, price, category, discountPercentage, discountStart, discountEnd } = req.body;

    const updateData = {
      name,
      description,
      price,
      category,
      discountPercentage: Number(discountPercentage || 0),
      discountStart: discountStart
        ? moment.tz(discountStart, "Asia/Karachi").toISOString()
        : null,
      discountEnd: discountEnd
        ? moment.tz(discountEnd, "Asia/Karachi").toISOString()
        : null,
    };

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    if (imageFile) updateData.imageUrl = await uploadToCloudinary(imageFile.path, "products/images");
    if (videoFile) updateData.videoUrl = await uploadToCloudinary(videoFile.path, "products/videos", { resource_type: "auto" });

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ message: "Product updated successfully", updatedProduct });
  } catch (err) {
    console.error("❌ Update product error:", err);
    res.status(500).json({ message: "Error updating product" });
  }
});

// ===== Delete Product =====
router.delete("/delete-product/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("❌ Delete product error:", err);
    res.status(500).json({ message: "Error deleting product" });
  }
});

// ===== User: Get All Products =====
router.get("/", async (req, res) => {
  try {
    const { search = "", category = "", page = 1, limit = 8 } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (category) filter.category = category;

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const categories = await Product.distinct("category");

    const updatedProducts = products.map((p) => {
      const { discountActive, discountExpiry, finalPrice, discountPercentage } = getDiscountInfo(p);
      return {
        ...p._doc,
        imageUrl: p.imageUrl,
        discountPercentage: discountActive ? discountPercentage : 0,
        discountStart: discountActive ? p.discountStart : null,
        discountEnd: discountActive ? p.discountEnd : null,
        finalPrice,
        discountExpiry,
        isDiscountActive: discountActive,
      };
    });

    res.json({
      products: updatedProducts,
      totalPages: Math.ceil(total / limit),
      categories,
    });
  } catch (err) {
    console.error("❌ Fetch products error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ===== User: Get Single Product =====
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { discountActive, discountExpiry, finalPrice, discountPercentage } = getDiscountInfo(product);

    res.json({
      ...product._doc,
      imageUrl: product.imageUrl,
      discountPercentage: discountActive ? discountPercentage : 0,
      discountStart: discountActive ? product.discountStart : null,
      discountEnd: discountActive ? product.discountEnd : null,
      finalPrice,
      discountExpiry,
      isDiscountActive: discountActive,
    });
  } catch (err) {
    console.error("❌ Single product fetch error:", err);
    res.status(500).json({ message: "Error fetching product" });
  }
});

export default router;
