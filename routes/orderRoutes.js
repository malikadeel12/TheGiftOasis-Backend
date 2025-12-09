import express from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";
import { sendOrderNotificationEmail, sendOrderConfirmationEmail } from "../utils/emailService.js";

const router = express.Router();

// ===== Create New Order (Customer) =====
router.post("/create", verifyToken, async (req, res) => {
  try {
    const { customerInfo, items, paymentInfo, totalAmount } = req.body;

    console.log("📥 Received order data:", JSON.stringify({ customerInfo, itemsCount: items?.length, paymentInfo, totalAmount }, null, 2));

    if (!customerInfo || !items || !paymentInfo || totalAmount === undefined) {
      return res.status(400).json({ 
        message: "Missing required fields",
        received: { 
          hasCustomerInfo: !!customerInfo, 
          hasItems: !!items, 
          hasPaymentInfo: !!paymentInfo, 
          totalAmount 
        }
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    // Validate customerInfo structure
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      return res.status(400).json({ message: "Customer info is incomplete (name, phone, address required)" });
    }

    // Validate paymentInfo structure
    if (!paymentInfo.method) {
      return res.status(400).json({ message: "Payment method is required" });
    }

    // Clean up items - ensure productId is valid ObjectId or null
    const cleanedItems = items.map((item) => ({
      productId: item.productId && mongoose.Types.ObjectId.isValid(item.productId) 
        ? item.productId 
        : null, // Allow null if productId is invalid
      name: item.name,
      quantity: Number(item.quantity),
      price: Number(item.price),
      imageUrl: item.imageUrl || "",
    }));

    const decodedUser = req.user;
    const userId = decodedUser?.id;

    // Determine customer email - use form email, fallback to token email
    const customerEmail = customerInfo.email?.trim() || decodedUser?.email?.trim() || null;
    
    console.log("📧 Email determination:", {
      formEmail: customerInfo.email,
      tokenEmail: decodedUser?.email,
      finalEmail: customerEmail,
    });

    const order = new Order({
      customerInfo: {
        ...customerInfo,
        email: customerEmail || undefined, // Store email if available
      },
      ...(userId ? { user: userId } : {}),
      items: cleanedItems,
      paymentInfo,
      totalAmount: Number(totalAmount),
      status: "pending",
    });

    console.log("💾 Attempting to save order...");
    await order.save();
    console.log("✅ Order saved successfully:", order.orderNumber);

    // Prepare order data for emails
    const orderDataForEmail = {
      orderNumber: order.orderNumber,
      customerInfo: order.customerInfo,
      items: order.items,
      totalAmount: order.totalAmount,
      paymentInfo: order.paymentInfo,
      createdAt: order.createdAt,
    };

    // Send email notification to admin
    try {
      const adminEmailResult = await sendOrderNotificationEmail(orderDataForEmail);
      if (adminEmailResult.success) {
        console.log("📧 Admin notification email sent successfully");
      } else {
        console.warn("⚠️ Failed to send admin notification email:", adminEmailResult.error);
      }
    } catch (emailError) {
      // Don't fail the order creation if email fails
      console.error("⚠️ Admin email notification error (order still created):", emailError);
    }

    // Send confirmation email to customer
    try {
      if (!order.customerInfo.email) {
        console.warn("⚠️ Customer email not available - skipping confirmation email");
        console.warn("⚠️ Email sources:", {
          formEmail: customerInfo.email,
          tokenEmail: decodedUser?.email,
          storedEmail: order.customerInfo.email,
        });
      } else {
        const customerEmailResult = await sendOrderConfirmationEmail(orderDataForEmail);
        if (customerEmailResult.success) {
          console.log("📧 Customer confirmation email sent successfully to:", order.customerInfo.email);
        } else {
          console.warn("⚠️ Failed to send customer confirmation email:", customerEmailResult.error);
        }
      }
    } catch (emailError) {
      // Don't fail the order creation if email fails
      console.error("⚠️ Customer email notification error (order still created):", emailError);
    }

    res.status(201).json({
      message: "Order placed successfully!",
      order: {
        orderNumber: order.orderNumber,
        _id: order._id,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    console.error("❌ Create order error:", err);
    console.error("❌ Error details:", {
      message: err.message,
      code: err.code,
      name: err.name,
      errors: err.errors,
      stack: err.stack,
    });
    
    if (err.code === 11000) {
      // Duplicate order number (rare case)
      return res.status(500).json({ message: "Order number conflict. Please try again." });
    }
    
    // Send more detailed error for debugging
    res.status(500).json({ 
      message: "Error creating order", 
      error: err.message,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

// ===== Get Logged-in User Orders =====
router.get("/user/history", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate("items.productId", "name imageUrl");

    res.json({ orders });
  } catch (err) {
    console.error("❌ Get user orders error:", err);
    res.status(500).json({ message: "Error fetching user orders" });
  }
});

// ===== Get Order by ID or Order Number (Customer/Admin) =====
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;

    // Try to find by orderNumber or _id
    const order = await Order.findOne({
      $or: [
        { orderNumber: identifier },
        { _id: identifier },
      ],
    }).populate("items.productId", "name imageUrl");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ order });
  } catch (err) {
    console.error("❌ Get order error:", err);
    res.status(500).json({ message: "Error fetching order" });
  }
});

// ===== Get All Orders (Admin Only) =====
router.get("/admin/all", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("items.productId", "name imageUrl");

    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total,
    });
  } catch (err) {
    console.error("❌ Get all orders error:", err);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// ===== Update Order Status (Admin Only) =====
router.put("/admin/update-status/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updateData = { status };
    if (notes) updateData.notes = notes;

    const order = await Order.findByIdAndUpdate(id, updateData, { new: true }).populate(
      "items.productId",
      "name imageUrl"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({
      message: "Order status updated successfully",
      order,
    });
  } catch (err) {
    console.error("❌ Update order status error:", err);
    res.status(500).json({ message: "Error updating order status" });
  }
});

// ===== Get Order Statistics (Admin Only) =====
router.get("/admin/stats", verifyToken, isAdmin, async (req, res) => {
  try {
    const total = await Order.countDocuments();
    const pending = await Order.countDocuments({ status: "pending" });
    const confirmed = await Order.countDocuments({ status: "confirmed" });
    const processing = await Order.countDocuments({ status: "processing" });
    const dispatched = await Order.countDocuments({ status: "dispatched" });
    const delivered = await Order.countDocuments({ status: "delivered" });
    const cancelled = await Order.countDocuments({ status: "cancelled" });

    // Total revenue (only delivered orders)
    const revenueResult = await Order.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      total,
      pending,
      confirmed,
      processing,
      dispatched,
      delivered,
      cancelled,
      totalRevenue,
    });
  } catch (err) {
    console.error("❌ Get stats error:", err);
    res.status(500).json({ message: "Error fetching statistics" });
  }
});

export default router;

