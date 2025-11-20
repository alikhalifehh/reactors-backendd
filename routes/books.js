import express from "express";
import Book from "../models/Book.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Create a new book
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               genre:
 *                 type: string
 *               description:
 *                 type: string
 *               coverImage:
 *                 type: string
 *     responses:
 *       201:
 *         description: Book created successfully
 */

// CREATE BOOK
router.post("/", auth, async (req, res) => {
  try {
    const { title, author, description, genre } = req.body;

    if (!title || title.length < 2) {
      return res.status(400).json({ message: "Title must be ≥ 2 characters" });
    }

    if (!author || author.length < 2) {
      return res.status(400).json({ message: "Author must be ≥ 2 characters" });
    }

    if (description && description.length > 500) {
      return res.status(400).json({ message: "Description too long" });
    }

    const book = await Book.create({
      title,
      author,
      description,
      genre,
      createdBy: req.user.id,
    });

    return res.status(201).json(book);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});

// GET ALL BOOKS
/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: Get all books
 *     tags: [Books]
 *     responses:
 *       200:
 *         description: List of all books
 */

router.get("/", async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// get my books
router.get("/mine", auth, async (req, res) => {
  try {
    const books = await Book.find({ createdBy: req.user.id }).sort({
      createdAt: -1,
    });

    return res.json({
      message: "Books created by user",
      count: books.length,
      books,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// get single book
/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Get a book by ID
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Book data
 *       404:
 *         description: Book not found
 */

router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ message: "Book not found" });

    res.json(book);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     summary: Update a book (creator only)
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Book updated
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 */

// UPDATE BOOK
router.put("/:id", auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (book.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (req.body.title && req.body.title.length < 2) {
      return res.status(400).json({ message: "Title too short" });
    }

    if (req.body.author && req.body.author.length < 2) {
      return res.status(400).json({ message: "Author too short" });
    }

    const updated = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    return res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     summary: Delete a book (creator only)
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Book deleted
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 */

// DELETE BOOK
router.delete("/:id", auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (book.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await book.deleteOne();

    return res.json({ message: "Book deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
