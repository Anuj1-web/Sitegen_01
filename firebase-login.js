// firebase-login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAc5c2Xogx4p2U0vYvOXZXpK9t9Wuir830",
  authDomain: "sitegen-47707.firebaseapp.com",
  projectId: "sitegen-47707",
  // Storage not required yet; keep default bucket value when you enable Storage.
  // storageBucket: "sitegen-47707.appspot.com",
  messagingSenderId: "111877204452",
  appId: "1:111877204452:web:d63661a96da882c93afff1",
  measurementId: "G-92RELFWJW2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, analytics };
