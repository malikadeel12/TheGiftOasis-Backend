import dotenv from "dotenv";
import connectDB from "../config/db.js";
import BlogPost from "../models/BlogPost.js";
import slugify from "slugify";

dotenv.config();

const seedPosts = [
  {
    title: "Gift Trends 2025: What’s Hot for Every Celebration",
    summary:
      "Discover the most-requested gifting ideas for birthdays, anniversaries, and corporate surprises in 2025 with tips on how to personalise each bundle.",
    coverImage:
      "https://images.unsplash.com/photo-1517303026135-096ae24cdb2e?auto=format&fit=crop&w=1200&q=80",
    tags: ["trends", "birthday", "corporate"],
    readingMinutes: 4,
    content: `
      <h2>What’s Trending in 2025</h2>
      <p>From pastel keepsakes to immersive experience boxes, 2025 is all about thoughtful personalisation. Customers love gifts that feel tailor-made, and curated hampers with handwritten notes still lead the way.</p>
      <h3>Top 3 Ideas</h3>
      <ul>
        <li><strong>Memory Lane Scrapbook:</strong> Combine instant polaroids with personalised stickers and heartfelt captions.</li>
        <li><strong>Corporate Calm Kit:</strong> Scented candles, herbal teas, and gratitude cards for employee appreciation.</li>
        <li><strong>Midnight Surprise Combo:</strong> Midnight cake delivery, LED balloons, and a voice-over dedication.</li>
      </ul>
      <p>Need help planning? Reach out to our concierge team on WhatsApp and we’ll design a bundle around your story.</p>
    `,
  },
  {
    title: "How to Build the Perfect Campaign Landing Page",
    summary:
      "Planning a seasonal promotion? Learn how The Gift Oasis structures high-converting landing pages for Valentine’s Day, Eid, and Black Friday.",
    coverImage:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
    tags: ["marketing", "campaigns", "guides"],
    readingMinutes: 5,
    content: `
      <h2>Start With a Story</h2>
      <p>Your landing page should open with the emotion behind your campaign. Are you celebrating love, gratitude, or milestones? Craft a headline that sparks that feeling immediately.</p>
      <h3>Checklist for Your Next Launch</h3>
      <ol>
        <li>Announce the offer with urgency — think “48 hour drop” or “limited handcrafted pieces”.</li>
        <li>Highlight 3 hero products with irresistible photography and short benefit bullets.</li>
        <li>Feature social proof — real customer quotes or unboxing reels work wonders.</li>
        <li>Add a WhatsApp CTA for quick conversions from mobile visitors.</li>
        <li>Close with FAQs so visitors feel confident enough to check out.</li>
      </ol>
      <p>Ready to co-create your campaign? Let’s collaborate on copy, visuals, and bundled offers that match your brand voice.</p>
    `,
  },
];

const run = async () => {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    for (const post of seedPosts) {
      const slug = slugify(post.title, { lower: true, strict: true, trim: true });
      const existing = await BlogPost.findOne({ slug });

      if (existing) {
        await BlogPost.updateOne(
          { slug },
          {
            ...post,
            slug,
            status: "published",
            publishedAt: existing.publishedAt || new Date(),
          }
        );
        console.log(`🔄 Updated existing post: ${post.title}`);
      } else {
        await BlogPost.create({
          ...post,
          slug,
          status: "published",
          publishedAt: new Date(),
        });
        console.log(`🆕 Created post: ${post.title}`);
      }
    }

    console.log("🎉 Blog seeding complete");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    process.exit(0);
  }
};

run();


