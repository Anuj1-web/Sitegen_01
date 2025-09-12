// signup2.js — FULL, explicit, robust
// Uses Firebase Web SDK v12.2.1 imports (make sure firebase-login.js uses the same)

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// IMPORTANT: firebase-login.js must export `auth` and `db` and use the same SDK version
import { auth, db } from "./firebase-login.js";

/* ---------- Expected HTML IDs (signup.html) ----------
#signupForm2, #name, #email, #password,
#resendVerificationBtn, #goToLoginBtn, #googleSignupBtn, #toastContainer
If missing, the script will create fallback controls so functionality still works.
------------------------------------------------------*/

// DOM references (create fallbacks when absent)
const signupForm = document.getElementById("signupForm2");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
let resendBtn = document.getElementById("resendVerificationBtn");
const goToLoginBtn = document.getElementById("goToLoginBtn");
const googleSignupBtn = document.getElementById("googleSignupBtn");
let toastContainer = document.getElementById("toastContainer");

// create toastContainer fallback if missing
if (!toastContainer) {
  toastContainer = document.createElement("div");
  toastContainer.id = "toastContainer";
  toastContainer.style.position = "fixed";
  toastContainer.style.top = "16px";
  toastContainer.style.right = "16px";
  toastContainer.style.zIndex = "999999";
  document.body.appendChild(toastContainer);
}

// create resendBtn fallback if missing (keeps behavior intact)
if (!resendBtn) {
  resendBtn = document.createElement("button");
  resendBtn.id = "resendVerificationBtn";
  resendBtn.textContent = "Resend Verification";
  resendBtn.style.display = "none";
  resendBtn.style.padding = "10px 14px";
  resendBtn.style.border = "none";
  resendBtn.style.borderRadius = "6px";
  resendBtn.style.background = "black";
  resendBtn.style.color = "white";
  resendBtn.style.marginTop = "10px";
  if (signupForm && signupForm.parentNode) signupForm.parentNode.insertBefore(resendBtn, signupForm.nextSibling);
  else document.body.appendChild(resendBtn);
}

/* ------------------------- Toast helper -------------------------
   Uses inline styles so toast is visible regardless of page CSS/theme.
-----------------------------------------------------------------*/
function showToast(message, success = true, duration = 4500) {
  const el = document.createElement("div");
  el.textContent = message;
  // inline styling to ensure visibility
  el.style.background = success ? "#16a34a" : "#dc2626";
  el.style.color = "#fff";
  el.style.padding = "10px 14px";
  el.style.borderRadius = "8px";
  el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
  el.style.fontWeight = "600";
  el.style.marginTop = "8px";
  el.style.maxWidth = "380px";
  el.style.zIndex = "100000";
  el.style.fontFamily = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial";
  toastContainer.appendChild(el);
  setTimeout(() => { try { el.remove() } catch(e){} }, duration);
}

/* ------------------------- Form helpers ------------------------- */
function disableFormInputs() {
  if (!signupForm) return;
  signupForm.querySelectorAll("input, button").forEach(el => {
    // keep goToLogin and googleSignup outside or enabled
    if (el.id === "goToLoginBtn" || el.id === "googleSignupBtn") return;
    try { el.disabled = true; } catch(e){}
  });
}
function enableFormInputs() {
  if (!signupForm) return;
  signupForm.querySelectorAll("input, button").forEach(el => { try { el.disabled = false; } catch(e){} });
}

/* ------------------------- Resend cooldown ------------------------- */
let cooldown = false;
let cooldownInterval = null;
function startResendCooldown(seconds = 30) {
  if (!resendBtn) return;
  cooldown = true;
  let t = seconds;
  resendBtn.disabled = true;
  resendBtn.style.display = "inline-block";
  resendBtn.textContent = `Resend in ${t}s`;
  resendBtn.style.background = "gray";
  clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    t--;
    if (t <= 0) {
      clearInterval(cooldownInterval);
      cooldown = false;
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification";
      resendBtn.style.background = "black";
    } else {
      resendBtn.textContent = `Resend in ${t}s`;
    }
  }, 1000);
}

/* ------------------- Polling for verification -------------------
   When we send a verification link, poll the Firebase user record
   (user.reload()) to detect emailVerified = true and then redirect.
-----------------------------------------------------------------*/
let pollingHandle = null;
async function pollForVerification(user, intervalMs = 3000, maxAttempts = 40) {
  // stop previous poll
  if (pollingHandle) clearInterval(pollingHandle);
  let attempts = 0;
  pollingHandle = setInterval(async () => {
    attempts++;
    try {
      await user.reload();
      if (user.emailVerified) {
        clearInterval(pollingHandle);
        pollingHandle = null;
        showToast("Email verified — redirecting to login...", true);
        // sign out so login flow is clean
        try { await auth.signOut(); } catch(e){}
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
      } else {
        if (attempts >= maxAttempts) {
          clearInterval(pollingHandle);
          pollingHandle = null;
          showToast("Still not verified. If you clicked the link, try logging in. You can resend the email.", false);
        }
      }
    } catch (err) {
      console.warn("pollForVerification reload error:", err);
      if (err?.code === "auth/network-request-failed") {
        showToast("Network issue checking verification. Try again later.", false);
        clearInterval(pollingHandle);
        pollingHandle = null;
      }
    }
  }, intervalMs);
}

/* ---------------------- SIGNUP SUBMIT HANDLER ----------------------
   Logic:
   1) fetchSignInMethodsForEmail(auth, email)
      - if methods.length > 0 => account exists => DO NOT CALL createUserWithEmailAndPassword
         * if 'password' in methods:
             - try signInWithEmailAndPassword(auth, email, password)
               - if sign-in success && !emailVerified => sendEmailVerification(user) -> show toast + start cooldown + poll
               - if sign-in success && emailVerified => tell user to login
               - if sign-in fails with wrong-password => sendPasswordResetEmail(auth, email) -> show toast
               - other sign-in errors -> show friendly message
         * else if 'google.com' in methods -> tell user to sign in with Google
         * else -> fallback: sendPasswordResetEmail (safe) and tell user
      - return (do NOT create user)
   2) methods empty -> createUserWithEmailAndPassword -> set Firestore doc -> sendEmailVerification -> start cooldown + poll
----------------------------------------------------------------------*/
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = (nameInput?.value || "").trim();
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  if (!email || !password) {
    showToast("Please enter an email and password.", false);
    return;
  }

  try {
    // ------------- check existing sign-in methods -------------
    let methods = [];
    try {
      methods = await fetchSignInMethodsForEmail(auth, email);
    } catch (fetchErr) {
      // network: fail fast and inform user
      if (fetchErr?.code === "auth/network-request-failed") {
        showToast("Network error. Check connection and try again.", false);
        return;
      }
      // If fetch fails for other reasons, log and continue cautiously:
      console.warn("fetchSignInMethodsForEmail error:", fetchErr);
      // but we still avoid blindly creating if email truly exists — prefer to inform user
    }

    if (Array.isArray(methods) && methods.length > 0) {
      // account exists — handle without showing "email already in use"
      // prefer password provider path
      if (methods.includes("password")) {
        try {
          // Try sign-in with provided password to get a user object we can send verification for
          const signInCred = await signInWithEmailAndPassword(auth, email, password);
          const user = signInCred.user;

          // if not verified -> resend verification
          if (!user.emailVerified) {
            try {
              await sendEmailVerification(user);
              showToast("Account exists but not verified — verification email resent. Check inbox & spam.", true);
              // create/ensure Firestore doc (merge)
              try { await setDoc(doc(db, "users", user.uid), { name: name || user.displayName || "User", email, role: "user" }, { merge: true }); } catch(e){ console.warn("setDoc error:", e); }
              disableFormInputs();
              startResendCooldown(30);
              pollForVerification(user);
              return;
            } catch (verr) {
              showToast("Could not resend verification: " + (verr.message || verr), false);
              return;
            }
          } else {
            showToast("This account is already verified — please login.", false);
            return;
          }
        } catch (signErr) {
          // sign-in failed (wrong password etc.)
          if (signErr?.code === "auth/wrong-password") {
            // Safe recovery: send password reset email and inform user
            try {
              await sendPasswordResetEmail(auth, email);
              showToast("Account exists. Wrong password — a password-reset email was sent so you can regain access & verify.", true);
              startResendCooldown(30);
              return;
            } catch (resetErr) {
              if (resetErr?.code === "auth/network-request-failed") {
                showToast("Network error while sending reset email. Try again later.", false);
                return;
              }
              showToast("Could not send reset email: " + (resetErr.message || resetErr), false);
              return;
            }
          } else if (signErr?.code === "auth/network-request-failed") {
            showToast("Network error while signing in. Try again.", false);
            return;
          } else {
            showToast(signErr.message || "Account exists — please try login or password reset.", false);
            return;
          }
        }
      }

      // If account exists but password provider is not present (e.g. google.com only)
      if (methods.includes("google.com") && !methods.includes("password")) {
        showToast("An account exists with Google sign-in. Please use 'Sign up with Google' or login with Google.", false);
        return;
      }

      // Generic fallback for other providers: send reset email as safe option
      try {
        await sendPasswordResetEmail(auth, email);
        showToast("Account exists — sent password reset email so you can regain access and verify.", true);
        startResendCooldown(30);
      } catch (fallbackErr) {
        if (fallbackErr?.code === "auth/network-request-failed") {
          showToast("Network error sending reset email. Try later.", false);
        } else {
          showToast("Account exists — please try signing in or resetting your password.", false);
        }
      }

      return; // very important: do NOT attempt to create user
    }

    // ------------- fresh email -> create user -------------
    // At this point methods is empty — safe to create
    let createResult;
    try {
      createResult = await createUserWithEmailAndPassword(auth, email, password);
    } catch (createErr) {
      // protect against race conditions / unexpected errors
      if (createErr?.code === "auth/network-request-failed") {
        showToast("Network error creating account. Try again.", false);
        return;
      }
      // If createErr is "email-already-in-use" something went wrong with our earlier check;
      // still, do not show raw error—give helpful guidance:
      if (createErr?.code === "auth/email-already-in-use") {
        // fallback: attempt to sign in then resend (defensive)
        try {
          const signInDef = await signInWithEmailAndPassword(auth, email, password);
          const user = signInDef.user;
          if (!user.emailVerified) {
            await sendEmailVerification(user);
            showToast("Account existed but not verified — verification resent.", true);
            disableFormInputs();
            startResendCooldown(30);
            pollForVerification(user);
            return;
          } else {
            showToast("Account already exists and verified. Please login.", false);
            return;
          }
        } catch (sErr) {
          showToast("Account exists. Try login or password reset.", false);
          return;
        }
      }

      showToast("Could not create account: " + (createErr.message || createErr), false);
      return;
    }

    // Successfully created
    const newUser = createResult.user;

    // Save Firestore user doc (merge)
    try {
      await setDoc(doc(db, "users", newUser.uid), { name: name || "User", email, role: "user" }, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore write failed:", fsErr);
      // proceed anyway
    }

    // Send verification
    try {
      await sendEmailVerification(newUser);
      showToast("Verification email sent. Please check inbox & spam.", true);
      disableFormInputs();
      startResendCooldown(30);
      pollForVerification(newUser);
      return;
    } catch (verErr) {
      if (verErr?.code === "auth/network-request-failed") {
        showToast("Network error sending verification. Try again.", false);
        return;
      }
      showToast("Could not send verification: " + (verErr.message || verErr), false);
      return;
    }
  } catch (outerErr) {
    console.error("Signup flow outer error:", outerErr);
    showToast("Signup failed: " + (outerErr.message || outerErr), false);
  }
});

/* ----------------- Resend verification click ----------------- */
resendBtn?.addEventListener("click", async (ev) => {
  ev?.preventDefault();
  if (cooldown) return;
  let user = auth.currentUser;
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  try {
    if (!user) {
      // Try silent sign-in with provided credentials
      if (email && password) {
        try {
          const s = await signInWithEmailAndPassword(auth, email, password);
          user = s.user;
        } catch (signErr) {
          if (signErr?.code === "auth/wrong-password") {
            // send reset email automatically
            try {
              await sendPasswordResetEmail(auth, email);
              showToast("Wrong password. Sent password reset email — use it to regain access & verify.", true);
              startResendCooldown(30);
              return;
            } catch (resetErr) {
              showToast("Could not send reset email: " + (resetErr.message || resetErr), false);
              return;
            }
          } else {
            showToast("Unable to sign you in. Please login first or use password reset.", false);
            return;
          }
        }
      } else {
        showToast("Please enter your email and password above to resend verification.", false);
        return;
      }
    }

    if (!user) {
      showToast("Unable to locate account to resend verification for.", false);
      return;
    }

    if (user.emailVerified) {
      showToast("Email is already verified. Please login.", true);
      return;
    }

    try {
      await sendEmailVerification(user);
      showToast("Verification email resent. Check inbox & spam.", true);
      startResendCooldown(30);
    } catch (err) {
      if (err?.code === "auth/network-request-failed") {
        showToast("Network error sending verification. Try again.", false);
        return;
      }
      showToast("Could not resend verification: " + (err.message || err), false);
    }
  } catch (err) {
    console.error("Resend click outer error:", err);
    showToast("Resend failed: " + (err.message || err), false);
  }
});

/* -------------------- Google signup flow -------------------- */
googleSignupBtn?.addEventListener("click", async (ev) => {
  ev?.preventDefault();
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    try {
      await setDoc(doc(db, "users", user.uid), { name: user.displayName || "User", email: user.email || "", role: "user", verified: !!user.emailVerified }, { merge: true });
    } catch (fsErr) {
      console.warn("Failed writing google user doc:", fsErr);
    }
    showToast("Signed in with Google. Redirecting...", true);
    await new Promise(r => setTimeout(r, 700));
    window.location.href = "index.html";
  } catch (err) {
    console.error("Google signup error:", err);
    if (err?.code === "auth/network-request-failed") {
      showToast("Network error during Google sign-in. Try again.", false);
    } else {
      showToast("Google sign-in failed: " + (err.message || err), false);
    }
  }
});

/* ------------- onAuthStateChanged: auto-redirect when verification completed ------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  // If user becomes verified, sign them out and redirect to login so they can log in normally
  try {
    if (user.emailVerified) {
      showToast("Email verified! Redirecting to login...", true);
      try { await auth.signOut(); } catch(e){}
      await new Promise(r => setTimeout(r, 900));
      window.location.href = "login.html";
    } else {
      // Show resend UI when user present but not verified
      resendBtn.style.display = "inline-block";
    }
  } catch (err) {
    console.warn("onAuthStateChanged handler error:", err);
  }
});
