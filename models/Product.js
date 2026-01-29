import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    category: { type: String },
    imageUrl: String, // For storing uploaded image URL
    videoUrl: String, // For storing uploaded video URL
    discountPercentage: { type: Number, default: 0 }, // percentage discount
    discountStart: { type: Date, default: null },
    discountEnd: { type: Date, default: null },

    // Marketing & merchandising flags
    isFeatured: { type: Boolean, default: false },
    promotionBadge: { type: String, default: "" }, // e.g. "Bundle Deal", "Limited Time"
    promoCode: { type: String, default: "" },
    promoDescription: { type: String, default: "" },
    promoExpiresAt: { type: Date, default: null },
    bundleItems: { type: [String], default: [] },

    // Aggregate review stats
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    
    // Inventory management
    stock: { type: Number, default: 0 },
    stockStatus: { type: String, enum: ["in_stock", "low_stock", "out_of_stock"], default: "in_stock" },
    lowStockThreshold: { type: Number, default: 5 },
  },
  { timestamps: true }
);

// Calculate final price based on discount & expiry
productSchema.methods.getFinalPrice = function () {
  const now = new Date();
  if (
    this.discountPercentage > 0 &&
    this.discountStart &&
    this.discountEnd &&
    now >= this.discountStart &&
    now <= this.discountEnd
  ) {
    return this.price - (this.price * this.discountPercentage / 100);
  }
  return this.price;
};

// Pre-save hook to update stock status
productSchema.pre("save", function (next) {
  if (this.stock <= 0) {
    this.stockStatus = "out_of_stock";
  } else if (this.stock <= this.lowStockThreshold) {
    this.stockStatus = "low_stock";
  } else {
    this.stockStatus = "in_stock";
  }
  next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;
