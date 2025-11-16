import mongoose from "mongoose";

const userBookSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },

    status: {
      type: String,
      enum: ["wishlist", "reading", "finished"],
      default: "wishlist",
    },

    progress: { type: Number, default: 0 },
    rating: { type: Number, min: 1, max: 5 },
    notes: { type: String },

    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("UserBook", userBookSchema);
