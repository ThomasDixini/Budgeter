// The E2E suite points the dev server at its own API instance through ORBIT_API_URL.
const apiUrl = process.env['ORBIT_API_URL'] ?? 'http://localhost:5099';

export default {
  '/api': {
    target: apiUrl,
    secure: false,
    pathRewrite: {
      '^/api': '',
    },
  },
};
