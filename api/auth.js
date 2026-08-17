// api/auth.js — Verifica la contraseña compartida del equipo para https://alertascpe.vercel.app/
//
// Configuración (1 minuto):
//   En el dashboard de Vercel → tu proyecto → Settings → Environment Variables
//   agrega APP_PASSWORD con la contraseña que quieras compartir con el equipo,
//   y redespliega. Si no configuras esta variable, la app queda sin contraseña
//   (acceso libre) — así el password es opcional, no obligatorio.
//
// El token que se entrega no expone la contraseña: es una marca de tiempo
// firmada (HMAC) con la propia contraseña como secreto, válida 30 días.
// api/store.js y api/scan.js verifican este token en cada solicitud.

import crypto from 'crypto';

export function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyToken(token, secret, maxAgeMs) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [ts, sig] = token.split('.');
  if (!ts || !sig) return false;
  if (!/^\d+$/.test(ts)) return false;
  if (Date.now() - Number(ts) > maxAgeMs) return false;
  const expected = sign(ts, secret);
  // comparación en tiempo constante
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') { res.status(405).json({ error: 'método no permitido' }); return; }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    res.status(501).json({ error: 'Sin contraseña configurada en el servidor (falta APP_PASSWORD)' });
    return;
  }

  let body = {};
  try { body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}'); }
  catch (_) {}
  const password = String(body.password || '');

  if (password !== appPassword) {
    res.status(401).json({ error: 'Contraseña incorrecta' });
    return;
  }
  const ts = Date.now().toString();
  const token = ts + '.' + sign(ts, appPassword);
  res.status(200).json({ ok: true, token });
}
