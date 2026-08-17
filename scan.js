// api/scan.js — Función serverless para https://alertascpe.vercel.app/
// Busca noticias recientes sobre el BID en Perú usando Google News RSS (gratis, sin clave)
// y las clasifica por dimensión/severidad. Si defines la variable de entorno
// ANTHROPIC_API_KEY en Vercel, la clasificación la refina Claude; si no, usa una
// heurística por palabras clave (igual de funcional, menos fina).
//
// Instalación: coloca este archivo en la carpeta /api de tu proyecto Vercel
// (alertascpe/api/scan.js) y redespliega. No requiere dependencias.

const DIMS = ['tecnico', 'social', 'reputacional', 'economico', 'politico'];

function heuristica(titulo) {
  const t = titulo.toLowerCase();
  if (/(protesta|paro|huelga|conflicto social|comunidad|vecinos|reclamo)/.test(t)) return { dimension: 'social', severity: 2 };
  if (/(corrupci|denuncia|investigaci[oó]n fiscal|esc[aá]ndalo|irregularidad|cuestiona)/.test(t)) return { dimension: 'reputacional', severity: 3 };
  if (/(congreso|elecci|censura|crisis pol|presidente|ministro|gabinete|vacancia)/.test(t)) return { dimension: 'politico', severity: 2 };
  if (/(retraso|paraliza|obra|licitaci|adjudicaci|ejecuci[oó]n|expediente t[eé]cnico)/.test(t)) return { dimension: 'tecnico', severity: 2 };
  if (/(pr[eé]stamo|aprueba|financia|millones|bono|inversi[oó]n|desembolso|cr[eé]dito)/.test(t)) return { dimension: 'economico', severity: 1 };
  return { dimension: 'reputacional', severity: 2 };
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

function parseRSS(xml) {
  const items = [];
  const blocks = String(xml).split('<item>').slice(1);
  for (const b of blocks) {
    const get = (tag) => {
      const m = b.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>'));
      return m ? decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()) : '';
    };
    let title = get('title');
    let source = get('source') || '';
    // Google News suele terminar el título en " - Fuente"
    if (!source && title.includes(' - ')) {
      const parts = title.split(' - ');
      source = parts.pop().trim();
      title = parts.join(' - ').trim();
    } else if (source && title.endsWith(' - ' + source)) {
      title = title.slice(0, -(' - ' + source).length).trim();
    }
    const link = get('link');
    const pub = get('pubDate');
    if (title) items.push({ title, url: link, source: source || 'Google News', pubDate: pub });
  }
  return items;
}

function parseJsonArrayLoose(text) {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  const start = clean.indexOf('[');
  if (start === -1) return null;
  const s = clean.slice(start);
  const end = s.lastIndexOf(']');
  if (end !== -1) {
    try { const p = JSON.parse(s.slice(0, end + 1)); if (Array.isArray(p)) return p; } catch (_) {}
  }
  let cut = s.lastIndexOf('}');
  while (cut !== -1) {
    try { const p = JSON.parse(s.slice(0, cut + 1) + ']'); if (Array.isArray(p)) return p; } catch (_) {}
    cut = s.lastIndexOf('}', cut - 1);
  }
  return null;
}

async function clasificarConClaude(items, apiKey) {
  const compact = items.map((it, i) => ({ i, title: it.title, source: it.source, date: it.date }));
  const prompt = `Clasifica estas noticias sobre el BID en Perú. Para cada una asigna:
- dimension: tecnico|social|reputacional|economico|politico
- severity: 1 (informativo/positivo), 2 (requiere seguimiento), 3 (riesgo alto/crisis)
- project: nombre del proyecto/operación BID si se identifica en el título, o "General BID Perú"

Noticias: ${JSON.stringify(compact)}

Responde SOLO con un array JSON compacto en una línea, sin texto adicional ni backticks: [{"i":0,"dimension":"...","severity":2,"project":"..."}, ...]`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error('Claude HTTP ' + r.status);
  const data = await r.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('\n');
  const parsed = parseJsonArrayLoose(text);
  if (!parsed) throw new Error('Clasificación ilegible');
  const byIndex = new Map(parsed.map(p => [Number(p.i), p]));
  return items.map((it, i) => {
    const c = byIndex.get(i);
    if (!c) return it;
    return {
      ...it,
      dimension: DIMS.includes(c.dimension) ? c.dimension : it.dimension,
      severity: [1, 2, 3].includes(Number(c.severity)) ? Number(c.severity) : it.severity,
      project: c.project ? String(c.project).slice(0, 80) : it.project,
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const q = String(req.query.q || '');
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));

    const base = '("BID" OR "Banco Interamericano de Desarrollo") Perú';
    const focus = q
      ? ' (' + q.split(',').map(s => '"' + s.trim() + '"').filter(s => s.length > 2).join(' OR ') + ')'
      : '';
    const query = base + focus + ' when:' + days + 'd';
    const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=es-419&gl=PE&ceid=PE:es-419';

    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (alertas-cpe)' } });
    if (!r.ok) throw new Error('Google News RSS HTTP ' + r.status);
    const xml = await r.text();

    const cutoff = Date.now() - days * 86400000;
    let items = parseRSS(xml)
      .map(it => {
        const d = new Date(it.pubDate);
        const valid = !isNaN(d.getTime());
        return {
          ...it,
          ts: valid ? d.getTime() : Date.now(),
          date: (valid ? d : new Date()).toISOString().slice(0, 10),
        };
      })
      .filter(it => it.ts >= cutoff)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10);

    let out = items.map(it => {
      const h = heuristica(it.title);
      return {
        date: it.date,
        title: it.title.slice(0, 180),
        source: it.source,
        url: it.url,
        dimension: h.dimension,
        severity: h.severity,
        project: 'General BID Perú',
      };
    });

    if (process.env.ANTHROPIC_API_KEY && out.length) {
      try { out = await clasificarConClaude(out, process.env.ANTHROPIC_API_KEY); }
      catch (e) { /* si Claude falla, se mantiene la heurística */ }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ items: out, classified_by: process.env.ANTHROPIC_API_KEY ? 'claude' : 'heuristica' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
