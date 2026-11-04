// jsdom has no 2D canvas and logs "Not implemented" on every getContext call; returning null up
// front gives the same result (the fire glow stays off) without flooding the test output.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
