import { createCloudHandler } from "../server/cloudHandler.js";
import { createCloudRepository } from "../server/cloudRepository.js";
import { getAdminServices } from "../server/firebaseAdmin.js";
export default createCloudHandler({
  verifyToken: token => getAdminServices().auth.verifyIdToken(token, true),
  repository: () => createCloudRepository(getAdminServices().db),
});
