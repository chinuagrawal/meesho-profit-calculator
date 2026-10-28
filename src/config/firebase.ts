import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase web configuration is public. Phone login uses this config; private data goes through the server API.
// VITE_* variables can override this when deploying to a different project.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAtyZUPXX3rqGCJVXNvJG5QJ7HDWKDYd20",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "meesho-profit-calculator-99652.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "meesho-profit-calculator-99652",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "meesho-profit-calculator-99652.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "804076445700",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:804076445700:web:351cb65f3644e4895d9551",
};
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
