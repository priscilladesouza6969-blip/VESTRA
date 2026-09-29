// Login das rotas /api/* via Supabase.
// Arquivos com "_" no início não viram rota pública na Vercel.
//
// O navegador envia "Authorization: Bearer <access_token>" e aqui o token é
// conferido direto no Supabase (GET /auth/v1/user).

function supabaseEnv() {
  return {
    url: String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

export async function getUser(req) {
  const { url, anonKey } = supabaseEnv();

  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);

  if (!url || !anonKey || !match) return null;

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${match[1]}`
      }
    });

    if (!response.ok) return null;

    const user = await response.json();

    return user && user.id ? user : null;
  } catch (error) {
    console.error("[VESTRA AUTH] Falha ao validar sessão:", error?.message);
    return null;
  }
}

// Retorna o usuário logado. Caso contrário, já respondeu 401/500.
export async function requireUser(req, res) {
  const { url, anonKey } = supabaseEnv();

  if (!url || !anonKey) {
    console.error("[VESTRA AUTH] SUPABASE_URL ou SUPABASE_ANON_KEY não configuradas.");
    res.status(500).json({
      error: "Login não configurado no Vercel."
    });
    return null;
  }

  const user = await getUser(req);

  if (!user) {
    res.status(401).json({
      error: "Faça login para continuar."
    });
    return null;
  }

  return user;
}

// Chamada ao banco com a chave de servidor (ignora RLS). Só usar no backend.
export async function serviceRest(path, options = {}) {
  const { url, serviceKey } = supabaseEnv();

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel.");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Supabase respondeu ${response.status}`);
  }

  return data;
}
