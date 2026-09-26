export function errorMiddleware(error, _req, res, _next) {
  console.error(error);
  const status = error.status ?? 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
}
