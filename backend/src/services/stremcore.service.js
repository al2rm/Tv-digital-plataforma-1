export const STREMCORE_BASE_URL = 'https://raw.githubusercontent.com/jexiptv07/stremcore/main';
export const STREMCORE_SOURCE = 'stremcore';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const fail = (message, statusCode = 502) => Object.assign(new Error(message), { statusCode });
const text = (value, max = 220) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const integer = (value, min, max, fallback = min) => Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
export const stremcoreType = value => {
  if (!['movies', 'series'].includes(value)) throw fail('Selecciona películas o series.', 400);
  return value;
};
export const stremcoreId = value => {
  if ((typeof value === 'number' && !Number.isSafeInteger(value)) || !/^[1-9][0-9]{0,17}$/.test(String(value))) throw fail('Identificador de Stremcore inválido.', 400);
  return String(value);
};
export const stremcoreNumber = (value, max = 10000) => {
  if (!/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw fail('Número de página, temporada o episodio inválido.', 400);
  return Number(value);
};
const genreValue = value => {
  const genre = value || 'all';
  if (typeof genre !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(genre)) throw fail('Género inválido.', 400);
  return genre;
};
export const stremcoreUrl = (value, allowHttp = false) => {
  try {
    if (typeof value !== 'string' || value.length > 4096) return null;
    const url = new URL(value);
    if (!(url.protocol === 'https:' || (allowHttp && url.protocol === 'http:')) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
};
export const isDirectStremcoreMedia = (value, allowHttp = false) => {
  const url = stremcoreUrl(value, allowHttp);
  return Boolean(url && /\.(m3u8|mpd|mp4|m4v|webm|ts)$/i.test(new URL(url).pathname));
};
const normalizeItem = item => ({
  id: stremcoreId(item.id), title: text(item.titulo ?? item.t), originalTitle: text(item.titulo_orig ?? item.to),
  poster: stremcoreUrl(item.poster ?? item.p), date: text(item.release_date ?? item.d, 20),
  genres: Array.isArray(item.genres ?? item.g) ? (item.genres ?? item.g).filter(g => typeof g === 'string' && /^[a-z0-9-]{1,60}$/.test(g)).slice(0,20) : [],
  rating: text(String(item.rating ?? item.r ?? ''), 10)
});
const itemsFrom = data => {
  if (!Array.isArray(data) || data.length > 3000) throw fail('Stremcore devolvió una lista inválida.');
  return data.map(item => { try { const normalized = normalizeItem(item); return normalized.title ? normalized : null; } catch { return null; } }).filter(Boolean);
};
const serversFrom = data => (Array.isArray(data) ? data.slice(0,50) : []).filter(server=>server&&typeof server==='object').map((server,index) => {
  const url = stremcoreUrl(server.url, true) || stremcoreUrl(server.player_url, true);
  return { id: String(server.id ?? index + 1), name: text(server.nombre, 80) || 'Servidor', language: text(server.idioma,40), quality: text(server.calidad,40), url, direct: isDirectStremcoreMedia(url, true) };
});
const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function createStremcoreClient({ fetchImpl = (...args) => globalThis.fetch(...args), now = Date.now, ttl = 300000 } = {}) {
  const cache = new Map(), pending = new Map();
  let cacheBytes = 0;
  async function json(path, signal) {
    const cached = cache.get(path);
    if (cached && cached.until > now()) { cache.delete(path); cache.set(path,cached); return cached.value; }
    if (cached) { cacheBytes -= cached.bytes; cache.delete(path); }
    if (pending.has(path)) return pending.get(path);
    const request = (async () => {
      let response;
      try {
        response = await fetchImpl(`${STREMCORE_BASE_URL}/${path}`, { headers: { Accept:'application/json' }, redirect:'error', signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
      } catch { throw fail('No se pudo conectar con Stremcore. Vuelve a intentarlo.', 502); }
      if (!response.ok) {
        await response.body?.cancel();
        throw fail(response.status === 404 ? 'Stremcore no tiene esta página o temporada.' : 'Stremcore no está disponible en este momento.', response.status === 404 ? 404 : 502);
      }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw fail('El archivo de Stremcore supera los 2 MB permitidos.'); }
      const reader = response.body?.getReader();
      if (!reader) throw fail('Stremcore devolvió una respuesta vacía.');
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > MAX_BYTES) { await reader.cancel(); throw fail('El archivo de Stremcore supera los 2 MB permitidos.'); }
          chunks.push(Buffer.from(part.value));
        }
      } catch (error) { if (error.statusCode) throw error; throw fail('La descarga de Stremcore se interrumpió. Reintenta.'); }
      finally { reader.releaseLock(); }
      let value;
      try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('Stremcore devolvió un archivo JSON inválido.'); }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('Stremcore devolvió un archivo JSON inválido.');
      while (cache.size && (cache.size >= 80 || cacheBytes + bytes > MAX_CACHE_BYTES)) {
        const key = cache.keys().next().value; cacheBytes -= cache.get(key).bytes; cache.delete(key);
      }
      cache.set(path,{ value, bytes, until:now()+ttl }); cacheBytes += bytes;
      return value;
    })();
    pending.set(path,request);
    try { return await request; } finally { pending.delete(path); }
  }
  async function meta() {
    const data = await json('meta.json');
    const genres = items => (Array.isArray(items) ? items.slice(0,100) : []).filter(g => g && /^[a-z0-9-]{1,60}$/.test(g.slug) && text(g.label,80)).map(g => ({ slug:g.slug, label:text(g.label,80), total:integer(g.total,0,10000000,0) }));
    if (![data.total_movies,data.total_series].every(value=>Number.isSafeInteger(value)&&value>=0&&value<=10000000)) throw fail('El resumen de Stremcore tiene un formato inválido.');
    return { movies: data.total_movies, series:data.total_series, perPage:40, movieGenres:genres(data.movie_genres), seriesGenres:genres(data.series_genres), source:STREMCORE_BASE_URL };
  }
  async function list(type, { page = 1, genre = 'all', q = '' } = {}) {
    type = stremcoreType(type); page = stremcoreNumber(page); genre = genreValue(genre);
    if (typeof q !== 'string' || q.length > 100) throw fail('La búsqueda admite hasta 100 caracteres.',400);
    q = q.trim();
    if (q) {
      if (q.length < 2) throw fail('Escribe al menos dos caracteres para buscar.',400);
      const signal = AbortSignal.timeout(11000), first = await json(`search/${type}/1.json`,signal);
      const count = stremcoreNumber(first.total_chunks,40);
      const needle = fold(q), seen = new Set();
      let matches = [], matchCount = 0, next = 2;
      const compare = (a,b) => a.title.localeCompare(b.title,'es') || a.id.localeCompare(b.id);
      const collect = chunk => {
        const found = [];
        for (const item of itemsFrom(chunk.data)) if (!seen.has(item.id) && (genre === 'all' || item.genres.includes(genre)) && fold(`${item.title} ${item.originalTitle}`).includes(needle)) {
          seen.add(item.id); found.push(item); matchCount++;
        }
        matches = matches.concat(found).sort(compare).slice(0,500);
      };
      collect(first);
      await Promise.all(Array.from({ length:Math.min(4,count-1) },async () => {
        while (next <= count) { const current = next++; collect(await json(`search/${type}/${current}.json`,signal)); }
      }));
      return { items:matches.slice((page-1)*40,page*40), page, total:matches.length, totalPages:Math.max(1,Math.ceil(matches.length/40)), query:q, truncated:matchCount>500 };
    }
    const data = await json(`pages/${type}/${genre}/${page}.json`);
    if (!Array.isArray(data.data) || data.data.length > 100 || Number(data.page) !== page) throw fail('La página de Stremcore tiene un formato inválido.');
    return { items:itemsFrom(data.data), page, total:integer(data.total,0,10000000,0), totalPages:integer(data.total_pages,1,100000,1), query:'' };
  }
  async function detail(type,id) {
    type = stremcoreType(type); id = stremcoreId(id);
    const data = await json(`${type}/${id}.json`);
    if (stremcoreId(data.id) !== id || !text(data.titulo)) throw fail('La ficha de Stremcore no coincide con el título solicitado.');
    return { ...normalizeItem(data), type, overview:text(data.overview,5000), backdrop:stremcoreUrl(data.backdrop), runtime:integer(data.runtime,1,3000,null), servers:serversFrom(data.servidores), sourceUrl:`${STREMCORE_BASE_URL}/${type}/${id}.json` };
  }
  async function season(id,number) {
    id = stremcoreId(id); number = stremcoreNumber(number,1000);
    const data = await json(`series/${id}/t${number}.json`);
    if (String(data.serie_id) !== id || Number(data.number) !== number || !Array.isArray(data.episodios) || data.episodios.length > 2000) throw fail('La temporada de Stremcore tiene un formato inválido.');
    const seen = new Set();
    const episodes = data.episodios.map(e => ({ number:stremcoreNumber(e.number), title:text(e.titulo) || `Episodio ${e.number}`, poster:stremcoreUrl(e.imagen), servers:serversFrom(e.servidores) }));
    for (const episode of episodes) { if (seen.has(episode.number)) throw fail('La temporada contiene números de episodio repetidos.'); seen.add(episode.number); }
    return { seriesId:id, number, episodes:episodes.sort((a,b)=>a.number-b.number) };
  }
  return { meta,list,detail,season };
}
export const stremcoreClient = createStremcoreClient();
