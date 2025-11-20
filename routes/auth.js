import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import querystring from "querystring";
import axios from "axios";
import auth from "../middleware/auth.js";
import { sendEmail } from "../utils/SendEmail.js";

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Google login: send the user to Google's login page
router.get("/google", (req, res) => {
  const params = querystring.stringify({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Google callback: Google redirects here after the user chooses an account
router.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).json({ message: "Missing Google code" });

    // Exchange the code for an access token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code,
      }
    );

    const { access_token } = tokenResponse.data;
    if (!access_token)
      return res.status(400).json({ message: "Failed to get Google token" });

    // Fetch Google profile
    const profileResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const { email, name, picture, id: googleId } = profileResponse.data;

    // Check if user already exists
    let user = await User.findOne({ email });

    // If new user, create a Google-based account
    if (!user) {
      user = await User.create({
        name,
        email,
        password: null,
        authProvider: "google",
        googleId,
        profilePic: picture,
        emailVerified: true,
      });
    }

    // Create JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Save token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    });

    return res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Google login failed", error: err.message });
  }
});

// Verify OTP for email verification during registration
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: "Missing OTP or user ID" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    // Handle lock after too many wrong attempts
    if (user.otpLockedUntil && user.otpLockedUntil > Date.now()) {
      return res
        .status(429)
        .json({ message: "Too many attempts, try again later" });
    }

    if (user.tempOTP !== otp) {
      user.otpAttempts += 1;

      if (user.otpAttempts >= 5) {
        user.otpLockedUntil = Date.now() + 5 * 60 * 1000;
        await user.save();
        return res
          .status(429)
          .json({ message: "Too many attempts, locked for 5 minutes" });
      }

      await user.save();
      return res.status(400).json({ message: "Incorrect code" });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Code expired" });
    }

    // Mark email as verified and clear OTP fields
    user.tempOTP = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.otpLockedUntil = null;
    user.emailVerified = true;

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    });

    return res.json({
      message: "Email verified and logged in",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        authProvider: user.authProvider,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Verification failed", error: err.message });
  }
});

// Resend verification code
router.post("/resend-otp", async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.tempOTP = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    user.otpAttempts = 0;
    user.otpLockedUntil = null;

    await user.save();

    const html = `
      <h2>Your new verification code</h2>
      <h1>${otp}</h1>
      <p>This code is valid for 5 minutes.</p>
    `;

    await sendEmail(user.email, "New verification code", html);

    return res.json({ message: "A new code has been sent" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Could not resend OTP", error: err.message });
  }
});

// Register with email and password (sends OTP)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Name validation
    const nameErrors = [];
    if (!name || name.trim().length < 2) nameErrors.push("Name too short");
    if (name.length > 30) nameErrors.push("Name too long");
    if (/\d/.test(name)) nameErrors.push("Name cannot contain numbers");

    if (nameErrors.length) {
      return res
        .status(400)
        .json({ message: "Invalid name", errors: nameErrors });
    }

    // Email validation
    const emailErrors = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) emailErrors.push("Invalid email format");
    if (!email.endsWith("@example.com"))
      emailErrors.push("Email must end with @example.com");

    if (emailErrors.length) {
      return res
        .status(400)
        .json({ message: "Invalid email", errors: emailErrors });
    }

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Password validation
    const passwordErrors = [];
    if (password.length < 8) passwordErrors.push("Minimum length is 8");
    if (!/[A-Z]/.test(password)) passwordErrors.push("Needs uppercase letter");
    if (!/[a-z]/.test(password)) passwordErrors.push("Needs lowercase letter");
    if (!/\d/.test(password)) passwordErrors.push("Needs a number");
    if (!/[@$!%*?&]/.test(password))
      passwordErrors.push("Needs a special character");

    if (passwordErrors.length) {
      return res
        .status(400)
        .json({ message: "Weak password", errors: passwordErrors });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      authProvider: "local",
      emailVerified: false,
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.tempOTP = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    user.otpAttempts = 0;
    user.otpLockedUntil = null;

    await user.save();

    const html = `
      <h2>Verify your account</h2>
      <h1>${otp}</h1>
      <p>This code expires in 5 minutes.</p>
    `;

    await sendEmail(email, "Verification code", html);

    return res.json({
      message: "Verification code sent",
      email,
      userId: user._id,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Registration failed", error: err.message });
  }
});

// Login with email and password
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    if (!user.password && user.authProvider === "google") {
      return res.status(400).json({
        message: "This account uses Google login only",
      });
    }

    if (user.authProvider === "local" && !user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
      });
    }

    const match = await bcrypt.compare(password, user.password || "");
    if (!match)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    });

    return res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        authProvider: user.authProvider,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Login failed", error: err.message });
  }
});

// Logout by clearing the cookie
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  return res.json({ message: "Logged out successfully" });
});

// Get the currently logged-in user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "id name email profilePic authProvider emailVerified"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: "User authenticated", user });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Could not fetch user", error: err.message });
  }
});

export default router;
