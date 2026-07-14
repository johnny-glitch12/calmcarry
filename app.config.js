// Dynamic Expo config. Returns app.json's config unchanged for normal dev/native
// builds, and layers in a few OPTIONAL, env/file-gated production wirings. Every
// branch is a no-op unless its trigger is present, so `npm run web` and today's
// EAS builds are unaffected until real credentials are dropped in.
const { existsSync } = require('fs');

module.exports = ({ config }) => {
  // Vercel showcase build: host the web app under "/app".
  if (process.env.EXPO_WEB_BASE_URL) {
    config.experiments = { ...(config.experiments || {}), baseUrl: process.env.EXPO_WEB_BASE_URL };
  }

  // Android FCM push: expo-notifications needs a google-services.json to mint an
  // FCM token. Wire it in when the founder provides one - either by path via
  // GOOGLE_SERVICES_JSON, or by dropping the file at ./google-services.json (both
  // gitignored). Absent → no key added, so builds without Android push still work,
  // and iOS is unaffected (it uses APNs, no Firebase file needed).
  const googleServices =
    process.env.GOOGLE_SERVICES_JSON ||
    (existsSync('./google-services.json') ? './google-services.json' : null);
  if (googleServices) {
    config.android = { ...(config.android || {}), googleServicesFile: googleServices };
  }

  return config;
};
