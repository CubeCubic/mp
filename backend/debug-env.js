module.exports = function (app) {
  // ВНИМАНИЕ: временный маршрут для отладки. Удалите этот файл и require после проверки.
  app.get('/api/_debug/env', (req, res) => {
    const access = process.env.IA_ACCESS_KEY;
    const secret = process.env.IA_SECRET_KEY;
    function mask(s) {
      if (!s) return null;
      const n = String(s);
      if (n.length <= 6) return '***';
      return n.slice(0,2) + '...' + n.slice(-2);
    }
    res.json({
      configured: !!access && !!secret,
      IA_ACCESS_KEY: mask(access),
      IA_SECRET_KEY: mask(secret),
      node_env: process.env.NODE_ENV || null
    });
  });
};
