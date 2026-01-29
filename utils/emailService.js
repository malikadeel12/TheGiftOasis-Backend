import dotenv from 'dotenv';

dotenv.config();

/**
 * Email Service Configuration
 * Primary: Brevo (Sendinblue) - Best for deliverability
 * 300 emails/day FREE, Never blocked on Render, Never goes to spam
 */

// Brevo (Sendinblue) configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_BASE_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Helper function to send email via Brevo REST API
 * @param {Object} emailData - Email data object with sender, to, subject, htmlContent, textContent
 * @returns {Promise<Object>} - Response object with success status
 */
const sendEmailViaBrevo = async (emailData) => {
  try {
    if (!BREVO_API_KEY) {
      console.warn("BREVO_API_KEY not set, skipping email send");
      return { success: false, error: "BREVO_API_KEY not configured" };
    }

    const response = await fetch(BREVO_BASE_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, messageId: result.messageId };
    } else {
      const errorData = await response.text();
      console.error("Brevo email error:", errorData);
      return { success: false, error: errorData };
    }
  } catch (error) {
    console.error("Error sending email via Brevo:", error);
    return { success: false, error: error.message };
  }
};

// Send order notification email to admin
export const sendOrderNotificationEmail = async (orderData) => {
  try {
    const { orderNumber, customerInfo, items, totalAmount, paymentInfo, createdAt } = orderData;

    // Format order items for email with category
    const itemsList = items
      .map(
        (item) =>
          `<tr>
            <td style="padding: 8px; border: 1px solid #ddd;">
              ${item.name}
              ${item.category ? `<br><span style="font-size: 11px; color: #666;">📁 ${item.category}</span>` : ''}
            </td>
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

    const emailData = {
      sender: {
        name: "The Gift Oasis",
        email: process.env.EMAIL_FROM || "thegiftoasis31@gmail.com"
      },
      to: [
        {
          email: process.env.ADMIN_EMAIL || "thegiftoasis31@gmail.com",
          name: "Admin"
        }
      ],
      subject: `🛍️ New Order Received - ${orderNumber}`,
      htmlContent: emailHTML,
      textContent: `
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
${items.map((item) => `${item.name}${item.category ? ` [${item.category}]` : ''} x ${item.quantity} = Rs.${(item.price * item.quantity).toFixed(2)}`).join("\n")}

Total Amount: Rs.${totalAmount.toFixed(2)}

Please process this order as soon as possible.
      `.trim()
    };

    const result = await sendEmailViaBrevo(emailData);
    
    if (result.success) {
      console.log("✅ Order notification email sent successfully:", result.messageId);
    } else {
      console.error("❌ Error sending order notification email:", result.error);
    }
    
    return result;
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

    // Format order items for email with category
    const itemsList = items
      .map(
        (item) =>
          `<tr>
            <td style="padding: 8px; border: 1px solid #ddd;">
              ${item.name}
              ${item.category ? `<br><span style="font-size: 11px; color: #666;">📁 ${item.category}</span>` : ''}
            </td>
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

    const emailData = {
      sender: {
        name: "The Gift Oasis",
        email: process.env.EMAIL_FROM || "thegiftoasis31@gmail.com"
      },
      to: [
        {
          email: customerInfo.email,
          name: customerInfo.name || "Customer"
        }
      ],
      subject: `✅ Order Confirmation - ${orderNumber} | The Gift Oasis`,
      htmlContent: emailHTML,
      textContent: `
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
${items.map((item) => `${item.name}${item.category ? ` [${item.category}]` : ''} x ${item.quantity} = Rs.${(item.price * item.quantity).toFixed(2)}`).join("\n")}

Total Amount: Rs.${totalAmount.toFixed(2)}

What's Next?
- Our team will review your order and payment
- You will receive a confirmation call or message once your order is confirmed
- Your order will be processed and dispatched as soon as possible
- You can track your order status using your order number: ${orderNumber}

Thank you for shopping with The Gift Oasis!
We appreciate your business.

If you have any questions, please contact us.
      `.trim()
    };

    const result = await sendEmailViaBrevo(emailData);
    
    if (result.success) {
      console.log("✅ Order confirmation email sent to customer:", result.messageId);
    } else {
      console.error("❌ Error sending order confirmation email to customer:", result.error);
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error sending order confirmation email to customer:", error);
    // Don't throw error - we don't want email failure to break order creation
    return { success: false, error: error.message };
  }
};

// Main and only email function
export const sendVerificationEmail = async (email, verificationCode) => {
  try {
    
    if (!BREVO_API_KEY) {
      return false;
    }
    
    const emailData = {
      sender: {
        name: "Selltron AI",
        email: "noreply.selltronai@gmail.com"
      },
      to: [
        {
          email: email,
          name: "User"
        }
      ],
      subject: "Your Selltron AI Verification Code",
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Code</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px;">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #D72638; margin: 0; font-size: 24px; font-weight: bold;">Selltron AI</h1>
              <p style="color: #666666; margin: 5px 0 0 0; font-size: 16px;">Email Verification</p>
            </div>
            
            <!-- Content -->
            <div>
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 20px; text-align: center;">Your Verification Code</h2>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #f8f9fa; border: 2px solid #D72638; border-radius: 8px; padding: 20px; display: inline-block;">
                  <span style="color: #D72638; font-size: 28px; font-weight: bold; letter-spacing: 3px; font-family: 'Courier New', monospace;">${verificationCode}</span>
                </div>
              </div>
              
              <div style="text-align: center; color: #666666; font-size: 14px; line-height: 1.5;">
                <p style="margin: 0 0 10px 0;">This verification code will expire in 5 minutes.</p>
                <p style="margin: 0;">If you didn't request this code, please ignore this email.</p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666666; font-size: 12px; margin: 0;">© 2024 Selltron AI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `Your Selltron AI verification code is: ${verificationCode}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nSelltron AI Team`
    };

    const result = await sendEmailViaBrevo(emailData);
    return result.success;
    
  } catch (error) {
    return false;
  }
};

// Send cofounder application confirmation email
export const sendCofounderConfirmationEmail = async (email, fullName) => {
  try {
    if (!BREVO_API_KEY) {
      console.warn("BREVO_API_KEY not set, skipping email send");
      return false;
    }

    const emailData = {
      sender: {
        name: "Sell Predator Team",
        email: "noreply.selltronai@gmail.com"
      },
      to: [
        {
          email: email,
          name: fullName || "Applicant"
        }
      ],
      subject: "Your Co-Founder Application Has Been Received - Sell Predator",
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Application Received</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px;">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3b82f6; margin: 0; font-size: 28px; font-weight: bold;">Sell Predator</h1>
              <p style="color: #666666; margin: 5px 0 0 0; font-size: 16px;">Co-Founder Application</p>
            </div>
            
            <!-- Content -->
            <div>
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Dear ${fullName || 'Applicant'},</h2>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for your interest in becoming a Co-Founder of Sell Predator!
              </p>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                <strong>Your application has been successfully received.</strong> Our team will review your application and contact you soon regarding the next steps.
              </p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
                  <strong>What happens next?</strong><br>
                  Our team will carefully review your application and get back to you via email or phone within the next few business days.
                </p>
              </div>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                We appreciate your interest in joining us on this exciting journey to revolutionize sales intelligence with AI.
              </p>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                Best regards,<br>
                <strong>The Sell Predator Team</strong>
              </p>
            </div>
            
            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666666; font-size: 12px; margin: 5px 0;">
                © ${new Date().getFullYear()} Sell Predator. All rights reserved.
              </p>
              <p style="color: #999999; font-size: 11px; margin: 5px 0;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `Dear ${fullName || 'Applicant'},

Thank you for your interest in becoming a Co-Founder of Sell Predator!

Your application has been successfully received. Our team will review your application and contact you soon regarding the next steps.

What happens next?
Our team will carefully review your application and get back to you via email or phone within the next few business days.

We appreciate your interest in joining us on this exciting journey to revolutionize sales intelligence with AI.

Best regards,
The Sell Predator Team

© ${new Date().getFullYear()} Sell Predator. All rights reserved.
This is an automated email. Please do not reply to this message.`
    };

    const result = await sendEmailViaBrevo(emailData);
    return result.success;
    
  } catch (error) {
    console.error("Error sending cofounder confirmation email:", error);
    return false;
  }
};

// Send admin notification email for new cofounder application
export const sendAdminNotificationEmail = async (cofounderData) => {
  try {
    if (!BREVO_API_KEY) {
      console.warn("BREVO_API_KEY not set, skipping admin email");
      return false;
    }

    const adminEmail = "adeelriaz384@gmail.com";
    
    const emailData = {
      sender: {
        name: "Sell Predator System",
        email: "noreply.selltronai@gmail.com"
      },
      to: [
        {
          email: adminEmail,
          name: "Admin"
        }
      ],
      subject: `New Co-Founder Application Received - ${cofounderData.fullName}`,
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Co-Founder Application</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px;">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px;">
              <h1 style="color: #3b82f6; margin: 0; font-size: 28px; font-weight: bold;">Sell Predator</h1>
              <p style="color: #666666; margin: 5px 0 0 0; font-size: 16px;">New Co-Founder Application Notification</p>
            </div>
            
            <!-- Alert Box -->
            <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #1e40af; font-size: 16px; font-weight: bold; margin: 0;">
                🎯 New Co-Founder Application Received
              </p>
            </div>
            
            <!-- Application Details -->
            <div style="margin: 25px 0;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">
                Applicant Information
              </h2>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold; width: 35%;">Full Name:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;">${cofounderData.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Email:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;"><a href="mailto:${cofounderData.email}" style="color: #3b82f6; text-decoration: none;">${cofounderData.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Phone:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;"><a href="tel:${cofounderData.phone}" style="color: #3b82f6; text-decoration: none;">${cofounderData.phone}</a></td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Company:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;">${cofounderData.company}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Position:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;">${cofounderData.position}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Experience:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;">${cofounderData.experience} years</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Industry:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;">${cofounderData.industry}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Location:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;">${cofounderData.location}</td>
                </tr>
                ${cofounderData.investmentInterest ? `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Investment Interest:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;">${cofounderData.investmentInterest}</td>
                </tr>
                ` : ''}
                ${cofounderData.linkedin ? `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">LinkedIn:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;"><a href="${cofounderData.linkedin}" target="_blank" style="color: #3b82f6; text-decoration: none;">${cofounderData.linkedin}</a></td>
                </tr>
                ` : ''}
                ${cofounderData.website ? `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #666666; font-weight: bold;">Website:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #333333;"><a href="${cofounderData.website}" target="_blank" style="color: #3b82f6; text-decoration: none;">${cofounderData.website}</a></td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- Why Join Section -->
            <div style="margin: 25px 0;">
              <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px;">Why They Want to Join:</h3>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
                <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${cofounderData.whyJoin}</p>
              </div>
            </div>
            
            <!-- Action Required -->
            <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #92400e; font-size: 15px; line-height: 1.6; margin: 0;">
                <strong>Action Required:</strong> Please review this application and contact the applicant at your earliest convenience.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666666; font-size: 12px; margin: 5px 0;">
                © ${new Date().getFullYear()} Sell Predator. All rights reserved.
              </p>
              <p style="color: #999999; font-size: 11px; margin: 5px 0;">
                This is an automated notification email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `New Co-Founder Application Received

Applicant Information:
- Full Name: ${cofounderData.fullName}
- Email: ${cofounderData.email}
- Phone: ${cofounderData.phone}
- Company: ${cofounderData.company}
- Position: ${cofounderData.position}
- Experience: ${cofounderData.experience} years
- Industry: ${cofounderData.industry}
- Location: ${cofounderData.location}
${cofounderData.investmentInterest ? `- Investment Interest: ${cofounderData.investmentInterest}\n` : ''}${cofounderData.linkedin ? `- LinkedIn: ${cofounderData.linkedin}\n` : ''}${cofounderData.website ? `- Website: ${cofounderData.website}\n` : ''}

Why They Want to Join:
${cofounderData.whyJoin}

Action Required: Please review this application and contact the applicant at your earliest convenience.

© ${new Date().getFullYear()} Sell Predator. All rights reserved.`
    };

    const result = await sendEmailViaBrevo(emailData);
    return result.success;
    
  } catch (error) {
    console.error("Error sending admin notification email:", error);
    return false;
  }
};

