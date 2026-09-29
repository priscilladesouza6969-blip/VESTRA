// Proteção compartilhada das rotas /api/*.
// Arquivos com "_" no início não viram rota pública na Vercel.
//
// 1) Origem: só aceita chamadas feitas por páginas do próprio VESTRA
//    (mesmo domínio da requisição, domínios da Vercel ou ALLOWED_ORIGINS).
// 2) Limite de uso por IP, em memória. Cada instância da função tem o seu
//    próprio contador, então é uma contenção básica, não um limite exato.

const WINDOW_MS = 10 * 60 * 1000;

const hits = new Map();

function hostOf(value) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

function allowedHosts(req) {
  const hosts = new Set();

  const requestHost = String(
    req.headers["x-forwarded-host"] || req.headers.host || ""
  ).split(",")[0].trim().toLowerCase();

  if (requestHost) hosts.add(requestHost);

  [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ]
    .filter(Boolean)
    .forEach((h) => hosts.add(h.toLowerCase()));

  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .forEach((o) => hosts.add(hostOf(o.includes("://") ? o : "https://" + o)));

  return hosts;
}

function isLocal(host) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

function originAllowed(req) {
  const origin = hostOf(req.headers.origin || "") || hostOf(req.headers.referer || "");

  if (!origin) return false;

  if (isLocal(origin) && process.env.VERCEL_ENV !== "production") return true;

  return allowedHosts(req).has(origin);
}

function clientIp(req) {
  return (
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    String(req.headers["x-real-ip"] || "").trim() ||
    req.socket?.remoteAddress ||
    "desconhecido"
  );
}

function rateLimited(key, limit, now) {
  if (hits.size > 5000) {
    for (const [k, entry] of hits) {
      if (entry.reset <= now) hits.delete(k);
    }
  }

  const entry = hits.get(key);

  if (!entry || entry.reset <= now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return 0;
  }

  entry.count++;

  return entry.count > limit ? Math.ceil((entry.reset - now) / 1000) : 0;
}

// Retorna true se a requisição pode seguir. Caso contrário, já respondeu.
export function guard(req, res, { name, limit }) {
  if (!originAllowed(req)) {
    console.warn(`[VESTRA GUARD] ${name}: origem bloqueada`, req.headers.origin || req.headers.referer || "sem origem");
    res.status(403).json({
      error: "Origem não permitida."
    });
    return false;
  }

  const retryAfter = rateLimited(`${name}:${clientIp(req)}`, limit, Date.now());

  if (retryAfter) {
    console.warn(`[VESTRA GUARD] ${name}: limite atingido`, clientIp(req));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "Muitas solicitações. Tente novamente em alguns minutos."
    });
    return false;
  }

  return true;
}

// Aceita imagem em data URL (enviada pelo navegador) ou URL https.
export function isImageInput(value, maxLength = 6_000_000) {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    (/^data:image\/(png|jpe?g|webp|heic|heif|gif);base64,/i.test(value) ||
      /^https:\/\//i.test(value))
  );
}

// Só para os testes.
export function _resetGuard() {
  hits.clear();
}
