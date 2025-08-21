// backend/routes/productRoutes.js
import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

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
    if (category) {
      filter.category = category;
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const categories = await Product.distinct("category");

    const now = new Date();

    res.json({
      products: products.map((p) => {
        // discount calculation
        let discountActive = false;
        let discountExpiry = null;

        if (p.discountPercentage > 0 && p.discountEnd) {
          discountExpiry = new Date(p.discountEnd);
          discountActive =
            discountExpiry >= now &&
            new Date(p.discountStart) <= now;
        }

        return {
          ...p._doc,
          imageUrl: p.imageUrl
            ? `${req.protocol}://${req.get("host")}${p.imageUrl}`
            : "",
          discount: p.discountPercentage || 0,
          discountExpiry,
          isDiscountActive: discountActive,
        };
      }),
      totalPages: Math.ceil(total / limit),
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});


export default router;
