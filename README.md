# Reactors Backend — Node.js / Express / MongoDB API

This is the backend REST API for Reactors, a full-stack book management platform.
It provides authentication (email/password, OTP, Google OAuth), book CRUD operations, reading list tracking, and secure session handling through cookies.

The backend powers the Reactors frontend and exposes endpoints for authentication, books, and user reading interactions.

# Deployment

## Frontend Deployment:
https://reactors-4x5p.vercel.app/

## Backend Deployment:
https://reactors-backendd.onrender.com

# Repositories

## Frontend Repository:
https://github.com/jawadtaki0/reactors

## Backend Repository:
https://github.com/alikhalifehh/reactors-backendd

# Backend Overview

The backend is built with:

Node.js + Express

MongoDB + Mongoose

JWT authentication (HTTP-only cookies)

Google OAuth 2.0

Email OTP verification

REST API architecture

CORS + secure sessions

Deployed on Render

# Project Structure
backend/
 ├── models/
 │     ├── user.js
 │     ├── Book.js
 │     └── UserBook.js
 ├── routes/
 │     ├── auth.js
 │     ├── books.js
 │     └── userBooks.js
 ├── middleware/
 │     └── authMiddleware.js
 ├── utils/
 │     ├── sendEmail.js
 │     └── generateOtp.js
 ├── server.js
 └── README.md

# Primary Data Models
## 1.User Model

Stores login credentials, verification state, and OAuth information.
Fields include:

name, email, password

otp, otpExpires, verified

authProvider (local / google)

Google OAuth data (googleId, profileImage)

📄 Model file: 

user

## 2.Book Model

Represents a book created by a user.
Fields include:

title, author, genre, description

owner (user who created it)

coverImage

createdAt, updatedAt

📄 Model file: 

Book

## 3.UserBook Model

Represents a user’s reading list entry.
Fields include:

bookId

status (wishlist / reading / finished)

progress (0–100)

rating (1–5)

notes

coverImage

userId

📄 Model file: 

UserBook

# Authentication Flow

The backend supports both local email/password login and Google OAuth.

## Registration Flow

User registers

System sends a 6-digit email OTP

User verifies OTP

User is logged in automatically

## Login Flow

Local login (email + password)

If email not verified → OTP required again

On success, backend sets HTTP-only JWT cookie

## Google OAuth Login Flow

Redirect user to Google

Google returns user profile

Backend creates/logs user in

JWT cookie is set automatically

Implemented in routes/auth.js:

auth

# Security

JWT stored in HTTP-only cookies (cannot be accessed by JavaScript)

CORS configured with strict origin rules

Password hashing with bcrypt

OTP expires after 10 minutes

Routes protected using authMiddleware

# API Documentation:


## Authentication Endpoints (`/api/auth`)

<details>
<summary><b>1. GET /api/auth/google — Start Google OAuth</b></summary>

Starts the Google login flow.

**Authentication:** Not required  
**Request Body:** None  
**Response:** Redirects to Google OAuth page.

</details>

---

<details>
<summary><b>2. GET /api/auth/google/callback — Google OAuth Callback</b></summary>

Handles Google OAuth, retrieves user info, creates/logs in user.

**Authentication:** Not required  
**Request Body:** None  
**Response:** Sets JWT cookie and redirects to frontend.

</details>

---

<details>
<summary><b>3. POST /api/auth/register — Register User</b></summary>

Creates a user and sends email OTP.

**Authentication:** Not required  
### Request Body
```json
{
  "name": "John Doe",
  "email": "john@gmail.com",
  "password": "StrongPass123!"
}
```

### Success Response
```json
{
  "success": true,
  "mfa": true,
  "message": "Verification code sent",
  "email": "john@gmail.com",
  "userId": "65f0be..."
}
```

</details>

---

<details>
<summary><b>4. POST /api/auth/verify-otp — Verify Registration OTP</b></summary>

### Request Body
```json
{
  "userId": "65f0be...",
  "otp": "123456"
}
```

### Success Response
```json
{
  "message": "Email verified and logged in",
  "user": {
    "id": "65f0be...",
    "name": "John Doe",
    "email": "john@gmail.com"
  }
}
```

**Authentication:** Not required  

</details>

---

<details>
<summary><b>5. POST /api/auth/resend-otp — Resend Verification OTP</b></summary>

### Request Body
```json
{ "userId": "65f0be..." }
```

**Authentication:** Not required  

</details>

---

<details>
<summary><b>6. POST /api/auth/login — Login with Email/Password</b></summary>

### Request Body
```json
{
  "email": "john@gmail.com",
  "password": "StrongPass123!"
}
```

### Success Response
```json
{
  "message": "Login successful",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@gmail.com",
    "authProvider": "local"
  }
}
```

**Authentication:** Not required  

</details>

---

<details>
<summary><b>7. POST /api/auth/logout — Logout</b></summary>

Clears JWT cookie.  

**Authentication:** User must be logged in**  
**Request Body:** None  
**Response:** `{ "message": "Logged out successfully" }`

</details>

---

<details>
<summary><b>8. GET /api/auth/me — Get Logged-in User</b></summary>

**Authentication:** Required  
**Response:** User info associated with JWT token.

</details>

---

<details>
<summary><b>9. GET /api/auth/user/:id — Get User by ID</b></summary>

**Authentication:** Not required  
**Response:** User profile.

</details>

---

<details>
<summary><b>10. POST /api/auth/forgot-password — Send Reset OTP</b></summary>

### Request Body
```json
{ "email": "john@gmail.com" }
```

</details>

---

<details>
<summary><b>11. POST /api/auth/verify-reset-otp — Verify Reset OTP</b></summary>

### Request Body
```json
{
  "email": "john@gmail.com",
  "otp": "123456"
}
```

</details>

---

<details>
<summary><b>12. POST /api/auth/reset-password — Reset Password</b></summary>

### Request Body
```json
{
  "userId": "65f0be...",
  "newPassword": "StrongPass123!"
}
```

</details>

---

# Book Endpoints (`/api/books`)

<details>
<summary><b>1. POST /api/books — Create Book</b></summary>

**Authentication:** Required  
### Request Body
```json
{
  "title": "Atomic Habits",
  "author": "James Clear",
  "description": "Build better habits",
  "genre": "Self-help"
}
```

### Response
Returns the newly created book.

</details>

---

<details>
<summary><b>2. GET /api/books — Get All Books</b></summary>

**Authentication:** Not required  
Returns full list of books.

</details>

---

<details>
<summary><b>3. GET /api/books/mine — Get Books by Current User</b></summary>

**Authentication:** Required  
Returns only books created by the logged-in user.

</details>

---

<details>
<summary><b>4. GET /api/books/:id — Get Single Book</b></summary>

**Authentication:** Not required  
Returns one book by ID.

</details>

---

<details>
<summary><b>5. PUT /api/books/:id — Update Book</b></summary>

**Authentication:** Required  
**Restriction:** Only creator can update.

### Example Body
```json
{ "title": "Updated Title" }
```

</details>

---

<details>
<summary><b>6. DELETE /api/books/:id — Delete Book</b></summary>

**Authentication:** Required  
**Restriction:** Only creator can delete.

</details>

---

# Reading List Endpoints (`/api/userbooks`)

<details>
<summary><b>1. POST /api/userbooks — Add Book to Reading List</b></summary>

**Authentication:** Required  

### Request Body
```json
{
  "bookId": "65f0be...",
  "status": "reading",
  "progress": 25,
  "rating": 4,
  "notes": "Very good book!",
  "coverImage": "https://example.com/image.jpg"
}
```

</details>

---

<details>
<summary><b>2. GET /api/userbooks — Get Reading List</b></summary>

**Authentication:** Required  
Returns all reading list entries for current user.

</details>

---

<details>
<summary><b>3. GET /api/userbooks/summary — Reading Status Summary</b></summary>

**Authentication:** Required  
Returns counts for wishlist, reading, finished.

### Example Response
```json
{
  "summary": {
    "wishlist": 2,
    "reading": 1,
    "finished": 3
  }
}
```

</details>

---

<details>
<summary><b>4. PUT /api/userbooks/:id — Update Reading List Entry</b></summary>

**Authentication:** Required  
### Request Body
```json
{
  "status": "finished",
  "progress": 100,
  "rating": 5,
  "notes": "Amazing book!"
}
```

</details>

---

<details>
<summary><b>5. DELETE /api/userbooks/:id — Delete Reading List Entry</b></summary>

**Authentication:** Required  
Deletes one entry.

</details>


# Running the Backend
## Step 1 — Clone repo
git clone https://github.com/alikhalifehh/reactors-backendd.git

## Step 2 — Install dependencies
npm install

## Step 3 — Create .env

MONGO_URI=mongodb+srv://jawadtaki_db_user:Reactors1234@reactors.ca1ekhx.mongodb.net/Reactors?
GOOGLE_CLIENT_ID=563014879392-xxxx
GOOGLE_CLIENT_SECRET=xxxx
REDIRECT_URI=https://reactors-backendd.onrender.com/api/auth/google/calllback
JWT_SECRET=xxxx
FRONTEND_URL=https://reactors-4x5p.vercel.app

## Step 4 — Start server
npm run dev

Backend runs at:

http://localhost:5000

# Backend Verification (Screenshots)

1. **Root API Endpoint**
   - URL: https://reactors-backendd.onrender.com/
   - Confirms that the API server is running.
   - ![Alt text](assets/api_running.png)

2. **Books Endpoint**
   - URL: https://reactors-backendd.onrender.com/api/books
   - Confirms that the Books API is reachable and returns data.
   - it shows the books that are available
   - ![Alt text](assets/get_books.png)

3. **Swagger API Documentation**
   - URL: https://reactors-backendd.onrender.com/api-docs
   - Swagger is used in order to displays all backend endpoints, HTTP methods, and schemas in a more professional way.
   - ![Alt text](assets/swagger.png)

4. **Environment Test Endpoint**
   - URL: https://reactors-backendd.onrender.com/api/auth/test-env
   - Used to verify that environment variables are loaded on Render.
   - ![Alt text](assets/test-env.png)

________________________________________________________________

| Name | Responsibilities |
|------|------------------|
| **Ali Khalifeh** | overall design, dark mode  |
| **Jawad Taki** | backend |
| **Hussein Sabra** | README.md, fixing book covers to fetch automatically |
| **Ali Daouk** | debugging |
