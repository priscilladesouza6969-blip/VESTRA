// Configuração pública do app (/app/). A chave "anon" do Supabase é pública
// por natureza: o acesso aos dados é protegido pelas regras (RLS) do banco.

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[VESTRA CONFIG] SUPABASE_URL ou SUPABASE_ANON_KEY não configuradas.");
    return res.status(500).json({
      error: "Login não configurado no Vercel."
    });
  }

  res.setHeader("Cache-Control", "public, max-age=300");

  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
}
