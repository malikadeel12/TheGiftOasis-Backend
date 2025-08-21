import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import Product from "../models/Product.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ===== Multer Config =====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
  },
});
const upload = multer({ storage });
// ===== Get All Products =====
router.get("/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const now = new Date();
    const updatedProducts = products.map(product => {
      let discountActive =
        product.discountPercentage > 0 &&
        product.discountStart &&
        product.discountEnd &&
        now >= product.discountStart &&
        now <= product.discountEnd;

      return {
        ...product._doc,
        imageUrl: product.imageUrl
          ? `${req.protocol}://${req.get("host")}${product.imageUrl}`
          : "",
        discountPercentage: discountActive ? product.discountPercentage : 0,
        discountStart: discountActive ? product.discountStart : null,
        discountEnd: discountActive ? product.discountEnd : null,
        finalPrice: discountActive
          ? product.getFinalPrice()
          : product.price
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

      const product = new Product({
        name,
        description,
        price,
        category,
        discountPercentage: discountPercentage || 0,
        discountStart: discountStart || null,
        discountEnd: discountEnd || null,
        imageUrl: req.file ? `/uploads/${req.file.filename}` : ""
      });

      await product.save();
      res.json({ message: "Product added successfully", product });
    } catch (err) {
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
        discountEnd: discountEnd || null
      };

      if (req.file) {
        updateData.imageUrl = `/uploads/${req.file.filename}`;
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      res.json({ message: "Product updated successfully", updatedProduct });
    } catch (err) {
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
