// Express 4 doesn't catch rejected promises from async route handlers —
// left alone, an unhandled rejection here crashes the whole Node process
// (Render then restarts it, taking down every in-flight request, not just
// the one that failed). Wrapping every handler forwards the error to the
// error middleware instead.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
