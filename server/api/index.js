// Vercel serverless function — delegates every request to the compiled Nest app.
// `npm run build` (vercel.json buildCommand) produces dist/serverless.js first.
module.exports = require('../dist/serverless').default;
