import { createAdminHandler } from "../server/adminHandler.js";
import { createAdminRepository } from "../server/adminRepository.js";
import { getAdminServices } from "../server/firebaseAdmin.js";
export default createAdminHandler({
  verifyToken: token => getAdminServices().auth.verifyIdToken(token, true),
  // The owner explicitly authorized for this project. An empty server override disables access.
  allowedUids: () => process.env.FIREBASE_ADMIN_UIDS ?? "k6rSzKZOdrUhHdgzM0dT09lX5S03",
  repository: () => { const { db, auth } = getAdminServices(); return createAdminRepository(db, auth); },
});
