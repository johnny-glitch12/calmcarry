// Dynamic Expo config. Returns app.json's config unchanged for normal dev/native
// builds, and ONLY applies a web base URL when EXPO_WEB_BASE_URL is set (used by the
// Vercel showcase build to host the web app under "/app"). Keeps `npm run web` and
// EAS builds unaffected.
module.exports = ({ config }) => {
  if (process.env.EXPO_WEB_BASE_URL) {
    config.experiments = { ...(config.experiments || {}), baseUrl: process.env.EXPO_WEB_BASE_URL };
  }
  return config;
};
