import nodemailer from "nodemailer";

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, // Your Gmail address
      pass: process.env.EMAIL_PASSWORD, // Your Gmail App Password
    },
  });
};

// Send order notification email to admin
export const sendOrderNotificationEmail = async (orderData) => {
  try {
    const { orderNumber, customerInfo, items, totalAmount, paymentInfo, createdAt } = orderData;

    const transporter = createTransporter();

    // Format order items for email
    const itemsList = items
      .map(
        (item) =>
          `<tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">Rs.${item.price.toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">Rs.${(item.price * item.quantity).toFixed(2)}</td>
          </tr>`
      )
      .join("");

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b9d, #ff8fab); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
            .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #ff6b9d; }
            .customer-info { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; }
            th { background: #ff6b9d; color: white; padding: 12px; text-align: left; }
            td { padding: 8px; border: 1px solid #ddd; }
            .total { font-size: 20px; font-weight: bold; color: #ff6b9d; text-align: right; margin-top: 15px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛍️ New Order Received!</h1>
            </div>
            <div class="content">
              <div class="order-info">
                <h2>Order Number: ${orderNumber}</h2>
                <p><strong>Date:</strong> ${new Date(createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p>
                <p><strong>Status:</strong> <span style="color: #ff9800; font-weight: bold;">Pending</span></p>
              </div>

              <div class="customer-info">
                <h3>👤 Customer Information</h3>
                <p><strong>Name:</strong> ${customerInfo.name}</p>
                <p><strong>Phone:</strong> ${customerInfo.phone}</p>
                ${customerInfo.email ? `<p><strong>Email:</strong> ${customerInfo.email}</p>` : ""}
                <p><strong>Address:</strong> ${customerInfo.address}</p>
              </div>

              <div class="customer-info">
                <h3>💳 Payment Information</h3>
                <p><strong>Payment Method:</strong> ${paymentInfo.method.toUpperCase()}</p>
                ${paymentInfo.screenshotUrl ? `<p><strong>Screenshot:</strong> <a href="${paymentInfo.screenshotUrl}" target="_blank">View Payment Screenshot</a></p>` : ""}
              </div>

              <div class="customer-info">
                <h3>📦 Order Items</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th style="text-align: center;">Quantity</th>
                      <th style="text-align: right;">Unit Price</th>
                      <th style="text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsList}
                  </tbody>
                </table>
                <div class="total">
                  Total Amount: Rs.${totalAmount.toFixed(2)}
                </div>
              </div>

              <div class="footer">
                <p>This is an automated notification from The Gift Oasis.</p>
                <p>Please process this order as soon as possible.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `"The Gift Oasis" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || "thegiftoasis31@gmail.com", // Admin email
      subject: `🛍️ New Order Received - ${orderNumber}`,
      html: emailHTML,
      text: `
New Order Received!

Order Number: ${orderNumber}
Date: ${new Date(createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}
Status: Pending

Customer Information:
Name: ${customerInfo.name}
Phone: ${customerInfo.phone}
${customerInfo.email ? `Email: ${customerInfo.email}` : ""}
Address: ${customerInfo.address}

Payment Information:
Payment Method: ${paymentInfo.method.toUpperCase()}
${paymentInfo.screenshotUrl ? `Screenshot: ${paymentInfo.screenshotUrl}` : ""}

Order Items:
${items.map((item) => `${item.name} x ${item.quantity} = Rs.${(item.price * item.quantity).toFixed(2)}`).join("\n")}

Total Amount: Rs.${totalAmount.toFixed(2)}

Please process this order as soon as possible.
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Order notification email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending order notification email:", error);
    // Don't throw error - we don't want email failure to break order creation
    return { success: false, error: error.message };
  }
};

// Send order confirmation email to customer
export const sendOrderConfirmationEmail = async (orderData) => {
  try {
    const { orderNumber, customerInfo, items, totalAmount, paymentInfo, createdAt } = orderData;

    // Check if customer has email
    if (!customerInfo.email) {
      console.log("⚠️ Customer email not provided, skipping confirmation email");
      return { success: false, error: "Customer email not provided" };
    }

    const transporter = createTransporter();

    // Format order items for email
    const itemsList = items
      .map(
        (item) =>
          `<tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">Rs.${item.price.toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">Rs.${(item.price * item.quantity).toFixed(2)}</td>
          </tr>`
      )
      .join("");

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
            .success-message { background: #d4edda; border: 2px solid #4CAF50; color: #155724; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
            .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #4CAF50; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; }
            th { background: #4CAF50; color: white; padding: 12px; text-align: left; }
            td { padding: 8px; border: 1px solid #ddd; }
            .total { font-size: 20px; font-weight: bold; color: #4CAF50; text-align: right; margin-top: 15px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .highlight { color: #4CAF50; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Order Successfully Received!</h1>
            </div>
            <div class="content">
              <div class="success-message">
                <h2 style="margin: 0; font-size: 24px;">🎉 Thank You for Your Order!</h2>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Your order has been successfully received and is being processed.</p>
              </div>

              <div class="order-info">
                <h2>📋 Order Details</h2>
                <p><strong>Order Number:</strong> <span class="highlight">${orderNumber}</span></p>
                <p><strong>Order Date:</strong> ${new Date(createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p>
                <p><strong>Status:</strong> <span style="color: #ff9800; font-weight: bold;">Pending Confirmation</span></p>
              </div>

              <div class="info-box">
                <h3>👤 Delivery Information</h3>
                <p><strong>Name:</strong> ${customerInfo.name}</p>
                <p><strong>Phone:</strong> ${customerInfo.phone}</p>
                <p><strong>Delivery Address:</strong> ${customerInfo.address}</p>
              </div>

              <div class="info-box">
                <h3>💳 Payment Information</h3>
                <p><strong>Payment Method:</strong> ${paymentInfo.method.toUpperCase()}</p>
                <p style="color: #666; font-size: 14px; margin-top: 10px;">
                  <em>Please ensure your payment has been completed. Our team will verify and confirm your order shortly.</em>
                </p>
              </div>

              <div class="info-box">
                <h3>📦 Your Order Items</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th style="text-align: center;">Quantity</th>
                      <th style="text-align: right;">Unit Price</th>
                      <th style="text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsList}
                  </tbody>
                </table>
                <div class="total">
                  Total Amount: Rs.${totalAmount.toFixed(2)}
                </div>
              </div>

              <div class="info-box" style="background: #e3f2fd; border-left: 4px solid #2196F3;">
                <h3 style="color: #1976D2; margin-top: 0;">📞 What's Next?</h3>
                <ul style="color: #555;">
                  <li>Our team will review your order and payment</li>
                  <li>You will receive a confirmation call or message once your order is confirmed</li>
                  <li>Your order will be processed and dispatched as soon as possible</li>
                  <li>You can track your order status using your order number: <strong>${orderNumber}</strong></li>
                </ul>
              </div>

              <div class="footer">
                <p><strong>The Gift Oasis</strong></p>
                <p>Thank you for shopping with us! We appreciate your business.</p>
                <p style="font-size: 11px; color: #999;">If you have any questions, please contact us.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `"The Gift Oasis" <${process.env.EMAIL_USER}>`,
      to: customerInfo.email, // Customer email
      subject: `✅ Order Confirmation - ${orderNumber} | The Gift Oasis`,
      html: emailHTML,
      text: `
✅ Order Successfully Received!

Thank you for your order! Your order has been successfully received and is being processed.

Order Details:
Order Number: ${orderNumber}
Order Date: ${new Date(createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}
Status: Pending Confirmation

Delivery Information:
Name: ${customerInfo.name}
Phone: ${customerInfo.phone}
Delivery Address: ${customerInfo.address}

Payment Information:
Payment Method: ${paymentInfo.method.toUpperCase()}

Please ensure your payment has been completed. Our team will verify and confirm your order shortly.

Your Order Items:
${items.map((item) => `${item.name} x ${item.quantity} = Rs.${(item.price * item.quantity).toFixed(2)}`).join("\n")}

Total Amount: Rs.${totalAmount.toFixed(2)}

What's Next?
- Our team will review your order and payment
- You will receive a confirmation call or message once your order is confirmed
- Your order will be processed and dispatched as soon as possible
- You can track your order status using your order number: ${orderNumber}

Thank you for shopping with The Gift Oasis!
We appreciate your business.

If you have any questions, please contact us.
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Order confirmation email sent to customer:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending order confirmation email to customer:", error);
    // Don't throw error - we don't want email failure to break order creation
    return { success: false, error: error.message };
  }
};

