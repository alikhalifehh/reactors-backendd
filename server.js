import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import bookRoutes from "./routes/books.js";
import userBookRoutes from "./routes/userBooks.js";

import { swaggerUiServe, swaggerUiSetup } from "./swagger.js";

dotenv.config();

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.set("trust proxy", 1);

// Parse JSON bodies
app.use(express.json());

// Parse cookies from incoming requests
app.use(cookieParser());

// Allow the React frontend to talk to this API with cookies
app.use(
  cors({
    origin: [FRONTEND_URL, "http://127.0.0.1:5173"],
    credentials: true,
  })
);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err.message));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/userbooks", userBookRoutes);

// Swagger docs
app.use("/api-docs", swaggerUiServe, swaggerUiSetup);

// Simple root route
app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
