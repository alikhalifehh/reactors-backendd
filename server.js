import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import bookRoutes from "./routes/books.js";
import userBookRoutes from "./routes/userbooks.js";
import { swaggerSpec, swaggerUiServe, swaggerUiSetup } from "./swagger.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173", // your Vite frontend URL
    credentials: true, // allow cookies
  })
);

import cookieParser from "cookie-parser";
app.use(cookieParser());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/userbooks", userBookRoutes);
app.use("/api-docs", swaggerUiServe, swaggerUiSetup(swaggerSpec));

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
