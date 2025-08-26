import express from "express";
import Product from "../models/Product.js";
import moment from "moment-timezone";

const router = express.Router();

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

// ===== Get All Products (User view) =====
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
      .sort({ createdAt: -1 }); // latest first

    const categories = await Product.distinct("category");

    res.json({
      products: products.map((p) => {
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
      }),
      totalPages: Math.ceil(total / limit),
      categories,
    });
  } catch (err) {
    console.error("❌ Fetch products error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ===== Get Single Product (User view) =====
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { discountActive, discountExpiry, finalPrice } = getDiscountInfo(product);

    res.json({
      ...product._doc,
      imageUrl: product.imageUrl,
      discountPercentage: discountActive ? product.discountPercentage : 0,
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
