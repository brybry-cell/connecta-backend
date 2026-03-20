const admin = require("firebase-admin");

const privateKey = process.env.FB_PRIVATE_KEY
  .replace(/\\n/g, '\n')   // handles \n version
  .replace(/\r/g, '');     // removes bad formatting

const serviceAccount = {
  type: process.env.FB_TYPE,
  project_id: process.env.FB_PROJECT_ID,
  private_key_id: process.env.FB_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.FB_CLIENT_EMAIL,
  client_id: process.env.FB_CLIENT_ID,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = { admin, db };