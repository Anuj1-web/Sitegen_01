import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { auth, db } from "./firebase-login.js";

// ----------------------
// DOM Elements
// ----------------------
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");

// Toast container
let toastContainer = document.getElementById("toastContainer");
if (!toastContainer) {
  toastContainer = document.createElement("div");
  toastContainer.id = "toastContainer";
  document.body.appendChild(toastContainer);
  toastContainer.style.position = "fixed";
  toastContainer.style.top = "20px";
  toastContainer.style.right = "20px";
  toastContainer.style.zIndex = "9999";
}

// ----------------------
// Toast System
// ----------------------
function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;

  // styling
  el.style.background = type === "error" ? "#f87171" : "#34d399"; // red or green
  el.style.color = "#fff";
  el.style.padding = "12px 16px";
  el.style.marginTop = "8px";
  el.style.borderRadius = "8px";
  el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  el.style.opacity = "0";
  el.style.transition = "opacity 0.3s ease";

  toastContainer.appendChild(el);

  setTimeout(() => (el.style.opacity = "1"), 50);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ----------------------
// Google Button
// ----------------------
let googleBtn = document.getElementById("googleLoginBtn");
if (!googleBtn) {
  const box = document.querySelector(".auth-form-box");
  if (box) {
    googleBtn = document.createElement("button");
    googleBtn.id = "googleLoginBtn";
    googleBtn.className = "btn w-full mt-4 bg-blue-500 text-white rounded-lg p-2";
    googleBtn.textContent = "Continue with Google";
    box.appendChild(googleBtn);
  }
}

// ----------------------
// Resend Verification Button
// ----------------------
let resendBtn = document.getElementById("resendVerifyBtn");
if (!resendBtn) {
  const box = document.querySelector(".auth-form-box");
  if (box) {
    resendBtn = document.createElement("button");
    resendBtn.id = "resendVerifyBtn";
    resendBtn.className = "btn w-full mt-2 bg-yellow-500 text-black rounded-lg p-2";
    resendBtn.textContent = "Resend Verification Email";
    box.appendChild(resendBtn);
  }
}
resendBtn.style.display = "none"; // hidden until needed

let cooldown = false;
if (resendBtn) {
  resendBtn.addEventListener("click", async () => {
    if (cooldown) {
      showToast("⏳ Please wait before resending again.", "error");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      showToast("⚠️ Log in first to resend verification.", "error");
      return;
    }
    try {
      await sendEmailVerification(user);
      showToast("📧 Verification email resent!");
      cooldown = true;
      resendBtn.disabled = true;
      setTimeout(() => {
        cooldown = false;
        resendBtn.disabled = false;
      }, 30000); // 30s cooldown
    } catch (err) {
      console.error("Resend failed:", err);
      showToast("❌ " + (err.code || "Failed to resend email"), "error");
    }
  });
}

// ----------------------
// Email/Password Login
// ----------------------
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (emailInput?.value || "").trim();
    const password = passwordInput?.value || "";

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        showToast("📧 Please verify your email. Verification link sent again.", "error");
        resendBtn.style.display = "block";
        return;
      }

      showToast("✅ Logged in successfully!");
      await applyAccessRules(user.uid);
    } catch (err) {
      console.error("Login failed:", err);
      showToast("❌ " + (err.code || "Login failed"), "error");
    }
  });
}

// ----------------------
// Forgot Password
// ----------------------
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = (emailInput?.value || "").trim();
    if (!email) {
      showToast("⚠️ Enter your email above first", "error");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("📬 Password reset email sent!");
    } catch (err) {
      console.error("Reset failed:", err);
      showToast("❌ " + (err.code || "Could not send reset email"), "error");
    }
  });
}

// ----------------------
// Google Sign-in
// ----------------------
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Ensure user doc exists
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          email: user.email || "",
          name: user.displayName || "User",
          role: "user"
        });
      }

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        showToast("📧 Verify your Google email. Link sent.", "error");
        resendBtn.style.display = "block";
        return;
      }

      showToast("✅ Google login successful!");
      await applyAccessRules(user.uid);
    } catch (err) {
      console.error("Google login failed:", err);
      showToast("❌ " + (err.code || "Google login failed"), "error");
    }
  });
}

// ----------------------
// Access Rules
// ----------------------
async function applyAccessRules(uid) {
  const current = window.location.pathname.split("/").pop() || "index.html";
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    const role = userDoc.data()?.role || "user";

    if (role === "admin") {
      // Admin → always library.html
      if (current !== "library.html") {
        window.location.href = "library.html";
      }
      resendBtn.style.display = "none";
      return;
    }

    // Normal user → always index.html, block library
    if (current === "library.html") {
      showToast("⚠️ You don't have access to Library.", "error");
      window.location.href = "index.html";
      return;
    }

    if (["login.html", "signup.html"].includes(current)) {
      window.location.href = "index.html";
    }

    resendBtn.style.display = "none"; // hide if already verified
  } catch (err) {
    console.error("Role check failed:", err);
    showToast("❌ Failed to verify user role", "error");
  }
}

// ----------------------
// Gate pages on load
// ----------------------
onAuthStateChanged(auth, async (user) => {
  const current = window.location.pathname.split("/").pop() || "index.html";

  if (!user) {
    if (current === "wizardmaker.html") {
      showToast("⚠️ Please log in to use the wizard.", "error");
      window.location.href = "login.html";
    }
    resendBtn.style.display = "none";
    return;
  }

  if (!user.emailVerified) {
    resendBtn.style.display = "block";
  } else {
    resendBtn.style.display = "none";
  }

  await applyAccessRules(user.uid);
});
