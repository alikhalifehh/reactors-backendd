import express from "express";
import UserBook from "../models/UserBook.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// ADD BOOK TO USER LIST (wishlist / reading / finished)
router.post("/", auth, async (req, res) => {
  try {
    const { bookId, status } = req.body;

    // Check if already exists
    const exists = await UserBook.findOne({
      user: req.user.id,
      book: bookId,
    });

    if (exists) {
      return res.status(400).json({ message: "Book already in your list" });
    }

    const entry = await UserBook.create({
      user: req.user.id,
      book: bookId,
      status: status || "wishlist",
    });

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET ALL BOOKS FOR LOGGED-IN USER
router.get("/", auth, async (req, res) => {
  try {
    const list = await UserBook.find({ user: req.user.id })
      .populate("book") // include book details
      .sort({ createdAt: -1 });

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// UPDATE USERBOOK ENTRY
router.put("/:id", auth, async (req, res) => {
  try {
    const entry = await UserBook.findById(req.params.id);

    if (!entry) return res.status(404).json({ message: "Entry not found" });

    if (entry.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const updated = await UserBook.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate("book");

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE FROM USER LIST
router.delete("/:id", auth, async (req, res) => {
  try {
    const entry = await UserBook.findById(req.params.id);

    if (!entry) return res.status(404).json({ message: "Entry not found" });

    if (entry.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await entry.deleteOne();

    res.json({ message: "Removed from your list" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
