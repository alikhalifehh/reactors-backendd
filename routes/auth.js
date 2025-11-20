import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import querystring from "querystring";
import axios from "axios";
import auth from "../middleware/auth.js";
import { sendEmail } from "../utils/SendEmail.js";

const router = express.Router();

// google redirection to login
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

// google callback
router.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).json({ message: "No code returned from Google" });
    }

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

    if (!access_token) {
      return res
        .status(400)
        .json({ message: "Failed to get Google access token" });
    }

    const profileResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const { email, name, picture, id: googleId } = profileResponse.data;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        password: null,
        authProvider: "google",
        googleId,
        profilePic: picture,
      });
    }

    // MFA process
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.tempOTP = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000; // OTP valid for 5 minutes
    await user.save();

    // SEND MFA OTP EMAIL
    const html = `
      <h2>Your Reactors Login Verification Code</h2>
      <p>Your login verification code is:</p>
      <h1 style="font-size: 32px; letter-spacing: 5px; color: #333;">${otp}</h1>
      <p>This code will expire in 5 minutes.</p>
    `;

    await sendEmail(email, "Your Reactors Verification Code", html);

    // MFA required
    return res.json({
      message: "MFA required",
      email: user.email,
      userId: user._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Google OAuth Error", error: err.message });
  }
});

// VERIFY OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: "Missing userId or otp" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // limit check
    if (user.otpLockedUntil && user.otpLockedUntil > Date.now()) {
      return res.status(429).json({
        message: "Too many failed attempts. Please try again later.",
      });
    }

    // OTP validation
    if (!user.tempOTP || user.tempOTP !== otp) {
      user.otpAttempts += 1;

      // lock after 5 attempts
      if (user.otpAttempts >= 5) {
        user.otpLockedUntil = Date.now() + 5 * 60 * 1000; // lock for 5 min
        await user.save();

        return res.status(429).json({
          message:
            "Too many incorrect attempts. Please wait 5 minutes before trying again.",
        });
      }

      await user.save();

      return res.status(400).json({ message: "Invalid OTP code" });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // reset field after success
    user.tempOTP = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.otpLockedUntil = null;

    await user.save();

    // jwt token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 60 * 60 * 1000,
    });

    return res.json({
      message: "OTP verified successfully",
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
      .json({ message: "Server error", error: err.message });
  }
});

// RESEND OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Reset OTP fields
    user.tempOTP = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    user.otpAttempts = 0; // reset attempts
    user.otpLockedUntil = null; // unlock user

    await user.save();

    // Send OTP email
    const html = `
      <h2>Your New Reactors Verification Code</h2>
      <p>Your updated login verification code is:</p>
      <h1 style="font-size: 32px; letter-spacing: 5px; color: #333;">${otp}</h1>
      <p>This code expires in 5 minutes.</p>
    `;

    await sendEmail(user.email, "Your New Reactors OTP Code", html);

    return res.json({
      message: "A new OTP has been sent to your email.",
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});

// REGISTER
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Email already registered
 */

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Name validation
    const nameErrors = [];

    if (!name || name.trim().length < 2)
      nameErrors.push("Name must be at least 2 characters.");

    if (name && name.length > 30)
      nameErrors.push("Name cannot exceed 30 characters.");

    if (/\d/.test(name)) nameErrors.push("Name cannot contain numbers.");

    if (nameErrors.length > 0) {
      return res.status(400).json({
        message: "Invalid name format",
        errors: nameErrors,
      });
    }

    // Email validation
    const emailErrors = [];

    if (!email) emailErrors.push("Email is required.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email))
      emailErrors.push("Email format is invalid.");

    if (email && !email.endsWith("@example.com"))
      emailErrors.push("Email must end with @example.com.");

    if (emailErrors.length > 0) {
      return res.status(400).json({
        message: "Invalid email format",
        errors: emailErrors,
      });
    }

    // Password validation
    const passwordErrors = [];

    if (password.length < 8 || password.length > 30)
      passwordErrors.push("Password must be between 8 and 30 characters.");

    if (!/[A-Z]/.test(password))
      passwordErrors.push(
        "Password must contain at least one uppercase letter."
      );

    if (!/[a-z]/.test(password))
      passwordErrors.push(
        "Password must contain at least one lowercase letter."
      );

    if (!/\d/.test(password))
      passwordErrors.push("Password must contain at least one number.");

    if (!/[@$!%*?&]/.test(password))
      passwordErrors.push(
        "Password must contain at least one special character."
      );

    if (passwordErrors.length > 0) {
      return res.status(400).json({
        message: "Invalid password format",
        errors: passwordErrors,
      });
    }

    // Check if user exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // Generate JWT token
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    // Response
    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LOGIN
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid email or password
 */

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Set JWT as an HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, //1hour
    });

    //respond without token (stored in cookie)
    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LOGOUT
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false, // set to true on HTTPS
    sameSite: "strict",
  });

  return res.json({ message: "Logged out successfully" });
});

// Get urrent user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "id name email profilePic authProvider"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User authenticated",
      user,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

export default router;
