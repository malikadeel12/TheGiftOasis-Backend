import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    orderNumber: {
      type: String,
      unique: true,
      // required: false, // Will be auto-generated in pre-save hook
    },
    customerInfo: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      email: { type: String },
    },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        imageUrl: String,
        category: { type: String, default: "" }, // Product category for admin insights
      },
    ],
    paymentInfo: {
      method: { type: String, required: true }, // easypaisa, bank
      screenshotUrl: String,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"],
      default: "pending",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    notes: String, // Admin notes
  },
  { timestamps: true }
);

// Generate unique order number before saving
orderSchema.pre("save", async function (next) {
  // Only generate if orderNumber is not set (for new documents)
  if (!this.orderNumber && this.isNew) {
    try {
      // Use this.constructor to get the model (safer than mongoose.model)
      const OrderModel = this.constructor;
      const count = await OrderModel.countDocuments();
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const sequence = String(count + 1).padStart(6, "0");
      this.orderNumber = `ORD-${year}${month}${day}-${sequence}`;
      next();
    } catch (err) {
      console.error("❌ Error generating order number:", err);
      // Fallback: use timestamp if count fails
      const timestamp = Date.now();
      this.orderNumber = `ORD-${timestamp}`;
      next();
    }
  } else {
    next();
  }
});

const Order = mongoose.model("Order", orderSchema);

export default Order;

