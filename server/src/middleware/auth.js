function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Missing or invalid x-api-key header." });
  }
  next();
}

module.exports = { requireApiKey };
