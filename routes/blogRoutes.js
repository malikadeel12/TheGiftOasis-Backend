import express from "express";
import slugify from "slugify";
import BlogPost from "../models/BlogPost.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

const buildSlug = (title) =>
  slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });

// ===== Public: list published posts =====
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 6, tag = "", search = "" } = req.query;
    const filter = { status: "published" };

    if (tag) {
      filter.tags = { $in: [tag] };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { summary: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const total = await BlogPost.countDocuments(filter);
    const posts = await BlogPost.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select("title slug summary coverImage tags readingMinutes publishedAt createdAt");

    const tagsAgg = await BlogPost.aggregate([
      { $match: { status: "published" } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    res.json({
      posts,
      totalPages: Math.ceil(total / limit),
      total,
      tags: tagsAgg.map((t) => ({ name: t._id, count: t.count })),
    });
  } catch (err) {
    console.error("❌ Blog list error:", err);
    res.status(500).json({ message: "Failed to load blog posts" });
  }
});

// ===== Public: single post by slug =====
router.get("/slug/:slug", async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, status: "published" });
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json({ post });
  } catch (err) {
    console.error("❌ Blog detail error:", err);
    res.status(500).json({ message: "Failed to fetch post" });
  }
});

// ===== Admin: list all posts =====
router.get("/admin/all", verifyToken, isAdmin, async (req, res) => {
  try {
    const posts = await BlogPost.find().sort({ createdAt: -1 });
    res.json({ posts });
  } catch (err) {
    console.error("❌ Blog admin list error:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// ===== Admin: create post =====
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      title,
      summary,
      content,
      coverImage,
      status = "draft",
      tags = [],
      readingMinutes,
      publishedAt,
      seoTitle,
      seoDescription,
    } = req.body;

    if (!title) return res.status(400).json({ message: "Title is required" });

    const slug = buildSlug(title);

    const post = await BlogPost.create({
      title,
      slug,
      summary,
      content,
      coverImage,
      status,
      tags,
      readingMinutes,
      publishedAt: publishedAt || (status === "published" ? new Date() : null),
      seoTitle,
      seoDescription,
    });

    res.status(201).json({ message: "Blog post created", post });
  } catch (err) {
    console.error("❌ Blog create error:", err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "A post with this slug already exists" });
    }
    res.status(500).json({ message: "Failed to create post" });
  }
});

// ===== Admin: update post =====
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.title) {
      updates.slug = buildSlug(updates.title);
    }
    if (updates.status === "published" && !updates.publishedAt) {
      updates.publishedAt = new Date();
    }
    const updated = await BlogPost.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Blog post updated", post: updated });
  } catch (err) {
    console.error("❌ Blog update error:", err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Slug already in use" });
    }
    res.status(500).json({ message: "Failed to update post" });
  }
});

// ===== Admin: delete post =====
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Blog post deleted" });
  } catch (err) {
    console.error("❌ Blog delete error:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

export default router;


