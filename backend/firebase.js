const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  // Check if we're running in a cloud environment
  if (process.env.FUNCTIONS_EMULATOR) {
    // Running in Firebase Functions emulator
    admin.initializeApp({
      projectId: "pantryapp-fd04e",
    });
  } else {
    // Running locally
    const serviceAccount = require(path.join(__dirname, "service-account.json"));
    admin.initializeApp({
      projectId: "pantryapp-fd04e",
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

module.exports = admin;
