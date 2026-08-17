// api/scan.js — Función serverless para https://alertascpe.vercel.app/
// Busca noticias recientes sobre el BID en Perú usando Google News RSS (gratis, sin clave)
// y las clasifica por dimensión/severidad. Si defines la variable de entorno
// ANTHROPIC_API_KEY en Vercel, la clasificación la refina Claude; si no, usa una
// heurística por palabras clave (igual de funcional, menos fina).
//
// Instalación: coloca este archivo en la carpeta /api de tu proyecto Vercel
// (alertascpe/api/scan.js) y redespliega. No requiere dependencias.

const DIMS = ['tecnico', 'social', 'reputacional', 'economico', 'politico'];


const PORTFOLIO = [{"code": "PE-L1224", "name": "Mejoramiento de los Servicios de Prevención del Delito en la Población Más Vulnerable al Crimen y la Violencia en El Perú"}, {"code": "PE-L1227", "name": "Programa para la Mejora de la Calidad y Pertinencia de los Servicios de Educación Superior Universitaria y Tecnológica a Nivel Nacional"}, {"code": "PE-L1228", "name": "Programa de \"Creación de Redes Integradas de Salud\""}, {"code": "PE-L1230", "name": "Programa de Mejoramiento de los Servicios de Justicia en Materia Penal en el Perú"}, {"code": "PE-L1231", "name": "Proyecto para la Mejora de la Eficiencia en la Gestión de la Inversión y las Contrataciones Públicas"}, {"code": "PE-L1232", "name": "Proyectos de Inversión Forestal Perú"}, {"code": "PE-L1238", "name": "Programa Integral de Drenaje Pluvial en ciudades priorizadas del Perú"}, {"code": "PE-L1239", "name": "Mejoramiento de los Servicios de Recaudación Tributaria y Aduanera a través de la Transformación Digital"}, {"code": "PE-L1240", "name": "Proyecto de Mejoramiento de los Servicios de Control Gubernamental para un Control Efectivo, Preventivo y Facilitador de la Gestión Pública"}, {"code": "PE-L1252", "name": "Programa de Infraestructura Vial para la Competitividad Regional (Proregión 1)"}, {"code": "PE-L1263", "name": "Programa de Innovación, Modernización Tecnológica y Emprendimiento"}, {"code": "PE-L1266", "name": "Proyecto de Mejoramiento de la Administración Financiera del Sector Público a través de la Transformación Digital."}, {"code": "PE-L1010", "name": "Programa de Garantías Ramal Norte del Amazonas IIRSA"}, {"code": "PE-L1258", "name": "Programa para Impulsar el Financiamiento Sostenible en la Amazonía Peruana – Oportunidad para Apalancar los Bionegocios (Programa para Bionegocios)"}, {"code": "PE-L1259", "name": "Proyecto de Mejoramiento y Ampliación del Servicio de Drenaje Pluvial de la Ciudad de Puerto Maldonado y el Centro Poblado El Triunfo en el Departamento de Madre de Dios"}, {"code": "PE-L1272", "name": "Programa de Financiamiento de Mujeres Emprendedoras en el Perú"}, {"code": "PE-L1269", "name": "Programa Integral de Agua y Saneamiento Rural, segunda fase - PIASAR II"}, {"code": "PE-L1250", "name": "Mejoramiento del Servicio de Abastecimiento Público de Bienes, Servicios y Obras"}, {"code": "PE-L1268", "name": "Programa de Inversión: Mejora de la calidad de los servicios de Educación Superior y Técnico-Productiva a nivel nacional"}, {"code": "PE-L1256", "name": "Proyecto de Inversión Mejoramiento y Ampliación del Servicio de Agua Potable, Alcantarillado Sanitario y Tratamiento de Aguas Residuales en los Distritos de Zarumilla y Aguas Verdes de la Provincia de Zarumilla – Departamento de Tumbes"}, {"code": "PE-L1279", "name": "Programa de Infraestructura Vial para la Competitividad Regional (PROREGION 2)"}, {"code": "PE-L1281", "name": "Proyecto de Transformación Digital con Equidad"}, {"code": "PE-L1285", "name": "Proyecto para la Ampliación y Mejoramiento de los Servicios de Agua Potable y Alcantarillado de la Ciudad de Juliaca - Puno"}, {"code": "PE-L1278", "name": "Mejoramiento de la Gestión de las Finanzas Públicas Subnacionales para la Sostenibilidad Fiscal"}, {"code": "PE-L1288", "name": "Programa de Apoyo a la Recuperación Fiscal y Económica de Perú II"}, {"code": "PE-J0001", "name": "Mejoramiento de los Servicios de la Oficina de Normalización Previsional"}, {"code": "PE-L1290", "name": "Mejoramiento de los Servicios de la Oficina de Normalización Previsional"}, {"code": "PE-L1280", "name": "Mejoramiento del Servicio de Inocuidad Agroalimentaria del SENASA"}, {"code": "PE-L1293", "name": "Programa de Impulso a la Vivienda Social en Perú"}, {"code": "PE-L1270", "name": "Proyecto de Mejoramiento de la Red de Servicios de Innovación, Tranferencia Tecnológica y Extensión Tecnológica Agraria en las Seis Estaciones Experimentales Agrarias del INIA"}, {"code": "PE-L1286", "name": "Proyecto de Transformación Digital del Banco de la Nación"}, {"code": "PE-L1284", "name": "Mejoramiento y Ampliación de los Servicios Operativos o Misionales Institucionales en el Centro Nacional de Planeamiento Estratégico"}, {"code": "PE-L1302", "name": "Mejoramiento integral de los servicios de readaptación social en el Perú"}, {"code": "PE-L1299", "name": "Creación del servicio de Acceso a Internet Fijo de última milla en las regiones Apurímac, Ayacucho y Junín"}, {"code": "PE-L1298", "name": "Programa de Electrificación Rural Sostenible y Productivo en la Amazonía Peruana"}, {"code": "PE-L1297", "name": "Programa de mejora de la calidad de los servicios de Primera Infancia en Perú"}, {"code": "PE-L1305", "name": "Programa de Innovación, Modernización Tecnológica y Emprendimiento II"}, {"code": "PE-L1292", "name": "Proyecto de tratamiento de aguas residuales y drenaje pluvial para la Ciudad de Juliaca, Puno"}, {"code": "PE-L1304", "name": "Mejoramiento del Acceso a los Servicios de Registros Civiles e Identificación de Calidad a Nivel Nacional (Fase II)"}, {"code": "PE-L1294", "name": "Programa de Apoyo a la Sostenibilidad del Modelo de Transporte Fluvial en la Amazonía"}];

const STOPWORDS = new Set(['de','del','la','las','los','el','en','para','con','su','sus','al','por','como','que','mas','más','y','a','un','una','uno',
  'mejoramiento','programa','proyecto','proyectos','servicio','servicios','nacional','peru','perú','republica','república','gestion','gestión',
  'mejora','ampliacion','ampliación','inversion','inversión','apoyo','integral','sostenible','publica','pública','publico','público','sector','nivel','fase']);

function distinctiveTerms(name, n) {
  n = n || 4;
  const words = String(name).replace(/["]/g,'').split(/[^\p{L}]+/u).filter(Boolean);
  const seen = new Set();
  const picked = [];
  for (const w of words) {
    const lw = w.toLowerCase();
    if (w.length < 5 || STOPWORDS.has(lw) || seen.has(lw)) continue;
    seen.add(lw);
    picked.push(w);
    if (picked.length >= n) break;
  }
  return picked;
}

function findProjectByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  return PORTFOLIO.find(p => p.code.toUpperCase() === c) || null;
}

function tagProject(title) {
  const t = String(title || '').toLowerCase();
  let best = null, bestScore = 0;
  for (const p of PORTFOLIO) {
    const terms = distinctiveTerms(p.name, 6);
    let score = 0;
    for (const term of terms) { if (t.includes(term.toLowerCase())) score++; }
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 2 ? best : null;
}

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
    const rawTerms = q ? q.split(',').map(s => s.trim()).filter(Boolean) : [];
    const clauses = rawTerms.map(term => {
      const proj = /^PE-[A-Z]\d{3,4}$/i.test(term) ? findProjectByCode(term) : null;
      if (proj) {
        const words = distinctiveTerms(proj.name, 4);
        return words.length ? words.join(' ') : term;
      }
      return '"' + term + '"';
    });
    const focus = clauses.length ? ' (' + clauses.join(' OR ') + ')' : '';
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
      const proj = tagProject(it.title);
      return {
        date: it.date,
        title: it.title.slice(0, 180),
        source: it.source,
        url: it.url,
        dimension: h.dimension,
        severity: h.severity,
        project: proj ? (proj.code + ' — ' + proj.name) : 'General BID Perú',
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
