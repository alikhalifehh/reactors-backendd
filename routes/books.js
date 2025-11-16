import express from "express";
import Book from "../models/Book.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// CREATE BOOK (authenticated)
router.post("/", auth, async (req, res) => {
  try {
    const { title, author, genre, description, coverImage } = req.body;

    const book = await Book.create({
      title,
      author,
      genre,
      description,
      coverImage,
      createdBy: req.user.id,
    });

    res.status(201).json(book);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// GET ALL BOOKS
router.get("/", async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// GET SINGLE BOOK
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ message: "Book not found" });

    res.json(book);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// UPDATE BOOK (must be creator)
router.put("/:id", auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ message: "Book not found" });

    // Only creator can edit
    if (book.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const updated = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// DELETE BOOK (must be creator)
router.delete("/:id", auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ message: "Book not found" });

    if (book.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await book.deleteOne();

    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

export default router;
