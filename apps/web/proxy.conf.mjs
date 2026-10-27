// The E2E suite points the dev server at its own API instance through BUDGETER_API_URL.
const apiUrl = process.env['BUDGETER_API_URL'] ?? 'http://localhost:5099';

export default {
  '/api': {
    target: apiUrl,
    secure: false,
    pathRewrite: {
      '^/api': '',
    },
  },
};
