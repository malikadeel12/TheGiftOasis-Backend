import express from "express";
import multer from "multer";
import Product from "../models/Product.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";
import moment from "moment-timezone";
import { uploadToImgBB } from "../utils/uploadImgBB.js";

const router = express.Router();

// ===== Multer Config =====
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only images allowed"), ok);
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

    discountExpiry = discountEnd.toISOString();
    discountActive = now.isBetween(discountStart, discountEnd, null, "[]");
  }

  return {
    discountActive,
    discountExpiry,
    finalPrice: discountActive ? product.getFinalPrice() : product.price,
  };
}

// ===== Admin Dashboard (All Products) =====
router.get("/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const updatedProducts = products.map((p) => {
      const { discountActive, discountExpiry, finalPrice } = getDiscountInfo(p);

      return {
        ...p._doc,
        imageUrl: p.imageUrl,
        discountPercentage: discountActive ? p.discountPercentage : 0,
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
router.post("/add-product", verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category, discountPercentage, discountStart, discountEnd } = req.body;
    let imageUrl = "";

    if (req.file) imageUrl = await uploadToImgBB(req.file.path);

    const product = new Product({
      name,
      description,
      price,
      category,
      discountPercentage: discountPercentage || 0,
      discountStart: discountStart || null,
      discountEnd: discountEnd || null,
      imageUrl,
    });

    await product.save();
    res.json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("❌ Add product error:", err);
    res.status(500).json({ message: "Error adding product" });
  }
});

// ===== Update Product =====
router.put("/update-product/:id", verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category, discountPercentage, discountStart, discountEnd } = req.body;

    const updateData = {
      name,
      description,
      price,
      category,
      discountPercentage: discountPercentage || 0,
      discountStart: discountStart || null,
      discountEnd: discountEnd || null,
    };

    if (req.file) updateData.imageUrl = await uploadToImgBB(req.file.path);

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

export default router;
