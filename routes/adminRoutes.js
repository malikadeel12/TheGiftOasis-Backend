import express from "express";
import multer from "multer";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Product from "../models/Product.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// ===== Multer Config (temp storage) =====
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only images allowed"), ok);
  },
});

// ===== Get All Products =====
router.get("/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const now = new Date();
    const updatedProducts = products.map((product) => {
      let discountActive =
        product.discountPercentage > 0 &&
        product.discountStart &&
        product.discountEnd &&
        now >= product.discountStart &&
        now <= product.discountEnd;

      return {
        ...product._doc,
        discountPercentage: discountActive ? product.discountPercentage : 0,
        discountStart: discountActive ? product.discountStart : null,
        discountEnd: discountActive ? product.discountEnd : null,
        finalPrice: discountActive ? product.getFinalPrice() : product.price,
      };
    });

    res.json({ products: updatedProducts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching products" });
  }
});

// ===== Add New Product =====
router.post(
  "/add-product",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, price, category, discountPercentage, discountStart, discountEnd } = req.body;

      let imageUrl = "";
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "products",
          resource_type: "image",
        });
        imageUrl = result.secure_url;
        fs.unlink(req.file.path, () => {}); // remove temp file
      }

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
      console.error("Add product error:", err);
      res.status(500).json({ message: "Error adding product" });
    }
  }
);

// ===== Update Product =====
router.put(
  "/update-product/:id",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req, res) => {
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

      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "products",
          resource_type: "image",
        });
        updateData.imageUrl = result.secure_url;
        fs.unlink(req.file.path, () => {}); // remove temp file
      }

      const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
      res.json({ message: "Product updated successfully", updatedProduct });
    } catch (err) {
      console.error("Update product error:", err);
      res.status(500).json({ message: "Error updating product" });
    }
  }
);

// ===== Delete Product =====
router.delete(
  "/delete-product/:id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      await Product.findByIdAndDelete(req.params.id);
      res.json({ message: "Product deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Error deleting product" });
    }
  }
);

export default router;
