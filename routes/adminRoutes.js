import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
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

function parseBundleItems(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((item) => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      // fall through to comma splitting
    }
    return input
      .replace(/\n/g, ",")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function decorateProduct(product) {
  const { discountActive, discountExpiry, finalPrice, discountPercentage } = getDiscountInfo(product);

  return {
    ...product._doc,
    imageUrl: product.imageUrl,
    discountPercentage: discountActive ? discountPercentage : 0,
    discountStart: discountActive ? product.discountStart : null,
    discountEnd: discountActive ? product.discountEnd : null,
    finalPrice,
    discountExpiry,
    isDiscountActive: discountActive,
    averageRating: Number(product.averageRating || 0),
    ratingCount: product.ratingCount || 0,
  };
}

async function recalculateProductRating(productId) {
  const result = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: "$product",
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  const stats = result[0];
  await Product.findByIdAndUpdate(productId, {
    averageRating: stats?.averageRating || 0,
    ratingCount: stats?.ratingCount || 0,
  });
}

// ===== Admin Dashboard (All Products) =====
router.get("/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const updatedProducts = products.map((p) => decorateProduct(p));

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
    const {
      name,
      description,
      price,
      category,
      discountPercentage,
      discountStart,
      discountEnd,
      isFeatured,
      promotionBadge,
      promoCode,
      promoDescription,
      promoExpiresAt,
      bundleItems,
    } = req.body;

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
      isFeatured: Boolean(isFeatured === "true" || isFeatured === true),
      promotionBadge: promotionBadge || "",
      promoCode: promoCode || "",
      promoDescription: promoDescription || "",
      promoExpiresAt: promoExpiresAt
        ? moment.tz(promoExpiresAt, "Asia/Karachi").toISOString()
        : null,
      bundleItems: parseBundleItems(bundleItems),
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
    const {
      name,
      description,
      price,
      category,
      discountPercentage,
      discountStart,
      discountEnd,
      isFeatured,
      promotionBadge,
      promoCode,
      promoDescription,
      promoExpiresAt,
      bundleItems,
    } = req.body;

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
      isFeatured: Boolean(isFeatured === "true" || isFeatured === true),
      promotionBadge: promotionBadge || "",
      promoCode: promoCode || "",
      promoDescription: promoDescription || "",
      promoExpiresAt: promoExpiresAt
        ? moment.tz(promoExpiresAt, "Asia/Karachi").toISOString()
        : null,
      bundleItems: parseBundleItems(bundleItems),
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

    const updatedProducts = products.map((p) => decorateProduct(p));

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
router.get("/highlights", async (req, res) => {
  try {
    const [featured, bundles, newArrivals] = await Promise.all([
      Product.find({ isFeatured: true }).sort({ updatedAt: -1 }).limit(8),
      Product.find({
        $or: [
          { bundleItems: { $exists: true, $ne: [] } },
          { promotionBadge: { $regex: /bundle|deal|offer/i } },
          { promoCode: { $ne: "" } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(8),
      Product.find().sort({ createdAt: -1 }).limit(8),
    ]);

    const bestSellerAggregation = await Order.aggregate([
      { $unwind: "$items" },
      { $match: { "items.productId": { $ne: null } } },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 8 },
    ]);

    const bestSellerIds = bestSellerAggregation.map((doc) => doc._id);
    const bestSellerProducts = await Product.find({ _id: { $in: bestSellerIds } });
    const bestSellers = bestSellerProducts
      .map((product) => {
        const stats = bestSellerAggregation.find((doc) => doc._id.toString() === product._id.toString());
        return {
          ...decorateProduct(product),
          totalSold: stats?.totalSold || 0,
        };
      })
      .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));

    res.json({
      featured: featured.map(decorateProduct),
      bundles: bundles.map(decorateProduct),
      newArrivals: newArrivals.map(decorateProduct),
      bestSellers,
    });
  } catch (err) {
    console.error("❌ Highlights fetch error:", err);
    res.status(500).json({ message: "Error fetching highlights" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const decorated = decorateProduct(product);

    res.json(decorated);
  } catch (err) {
    console.error("❌ Single product fetch error:", err);
    res.status(500).json({ message: "Error fetching product" });
  }
});

// ===== Reviews =====
router.get("/:id/reviews", async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.id })
      .sort({ createdAt: -1 })
      .populate("user", "firstName lastName email");

    res.json({
      reviews,
    });
  } catch (err) {
    console.error("❌ Fetch reviews error:", err);
    res.status(500).json({ message: "Error fetching reviews" });
  }
});

router.post("/:id/reviews", verifyToken, async (req, res) => {
  try {
    const { rating, title, comment } = req.body;
    if (!rating) {
      return res.status(400).json({ message: "Rating is required" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const payload = {
      product: req.params.id,
      user: req.user.id,
      rating: Number(rating),
      title: title || "",
      comment: comment || "",
    };

    let review = await Review.findOne({ product: req.params.id, user: req.user.id });
    if (review) {
      review.rating = payload.rating;
      review.title = payload.title;
      review.comment = payload.comment;
      await review.save();
    } else {
      review = await Review.create(payload);
    }

    await recalculateProductRating(req.params.id);

    const populated = await review.populate("user", "firstName lastName email");

    res.status(201).json({
      message: "Review saved successfully",
      review: populated,
    });
  } catch (err) {
    console.error("❌ Save review error:", err);
    res.status(500).json({ message: "Error saving review" });
  }
});

router.delete("/:id/reviews/:reviewId", verifyToken, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      product: req.params.id,
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not allowed" });
    }

    await review.deleteOne();
    await recalculateProductRating(req.params.id);

    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    console.error("❌ Delete review error:", err);
    res.status(500).json({ message: "Error deleting review" });
  }
});

export default router;
