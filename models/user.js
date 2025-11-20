import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      default: null,
    },

    // For OAuth users
    authProvider: {
      type: String, // goolge or local
      default: "local",
    },

    googleId: { type: String, default: null },
    githubId: { type: String, default: null },
    appleId: { type: String, default: null },

    profilePic: { type: String, default: null },

    // MFA
    tempOTP: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
    otpLockedUntil: { type: Date, default: null },

    mfaEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
