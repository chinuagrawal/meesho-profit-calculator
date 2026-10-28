import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readAdminCredentials } from "./adminCredentials.js";
export function getAdminServices() {
  const name = "meesho-backend";
  let app = getApps().find(app => app.name === name);
  if (!app) {
    const credentials = readAdminCredentials(process.env);
    app = initializeApp({ credential: cert(credentials), projectId: credentials.projectId }, name);
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}
