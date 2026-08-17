// api/store.js — Almacenamiento compartido del equipo para https://alertascpe.vercel.app/
//
// Con esto, las alertas y palabras clave se guardan en un almacén central y
// TODO el equipo ve los mismos datos, sin importar desde qué navegador entren.
//
// Requisito (5 minutos, gratis):
//   1. En el dashboard de Vercel, pestaña "Storage" del proyecto → "Create Database"
//      → elige "Upstash for Redis" (plan gratuito) → conéctalo al proyecto.
//      Eso crea automáticamente las variables UPSTASH_REDIS_REST_URL y
//      UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_URL / KV_REST_API_TOKEN).
//   2. Coloca este archivo en /api/store.js y redespliega.
//
// Si el almacén no está configurado, responde 501 y la app guarda los datos
// solo en el navegador de cada usuario (localStorage) — funcional, pero no compartido.

const ALLOWED_KEYS = ['alerts', 'scan-keywords'];

import { verifyToken } from './auth.js';
const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const appPassword = process.env.APP_PASSWORD;
  if (appPassword) {
    const token = req.headers['x-cpe-auth'];
    if (!verifyToken(token, appPassword, THIRTY_DAYS)) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
  }

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    res.status(501).json({ error: 'Almacén compartido no configurado (falta Upstash Redis)' });
    return;
  }

  const redis = async (cmd) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) throw new Error('Redis HTTP ' + r.status);
    return (await r.json()).result;
  };

  try {
    if (req.method === 'GET') {
      const key = String(req.query.key || '');
      if (!ALLOWED_KEYS.includes(key)) { res.status(400).json({ error: 'clave no permitida' }); return; }
      const value = await redis(['GET', 'cpe:' + key]);
      res.status(200).json({ key, value: value == null ? null : String(value) });
    } else if (req.method === 'POST') {
      const body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
      const key = String(body.key || '');
      const value = String(body.value || '');
      if (!ALLOWED_KEYS.includes(key)) { res.status(400).json({ error: 'clave no permitida' }); return; }
      if (value.length > 500000) { res.status(413).json({ error: 'contenido demasiado grande' }); return; }
      await redis(['SET', 'cpe:' + key, value]);
      res.status(200).json({ ok: true });
    } else {
      res.status(405).json({ error: 'método no permitido' });
    }
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
