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

const Product = mongoose.model("Product", productSchema);
export default Product;
