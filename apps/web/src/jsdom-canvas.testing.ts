// jsdom has no 2D canvas and logs "Not implemented" on every getContext call; returning null up
// front gives the same result (the fire glow stays off) without flooding the test output.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

// The runner shares one jsdom between spec files (Vitest is not isolated here), so a session or a setting a
// spec leaves in the browser storage would be found by whichever spec runs next in the same worker; that
// made the "starts with no one signed in" spec fail now and then. Every test therefore starts with empty
// storage. This file runs once per spec file, so the hook may be registered more than once: clearing twice is harmless.
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
