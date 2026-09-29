import { guard } from "./_guard.js";
import { requireUser, serviceRest } from "./_auth.js";

// Devolve o perfil da pessoa logada e mantém o papel OWNER sincronizado com
// a variável OWNER_EMAIL da Vercel. O papel nunca é definido pelo navegador.

function isOwnerEmail(user) {
  const owners = String(process.env.OWNER_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Só vale com e-mail confirmado (Google já vem confirmado).
  return (
    !!user.email_confirmed_at &&
    owners.includes(String(user.email || "").toLowerCase())
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  if (!guard(req, res, { name: "me", limit: 60 })) return;

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const id = encodeURIComponent(user.id);

    let [profile] = await serviceRest(`profiles?id=eq.${id}&select=*`);

    if (!profile) {
      // Conta criada antes do gatilho existir: cria o perfil agora.
      [profile] = await serviceRest("profiles", {
        method: "POST",
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: String(user.user_metadata?.name || user.user_metadata?.full_name || "").slice(0, 100)
        })
      });
    }

    const role = isOwnerEmail(user) ? "owner" : "user";

    if (profile.role !== role) {
      [profile] = await serviceRest(`profiles?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
    }

    return res.status(200).json({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        trialStartedAt: profile.trial_started_at,
        plan: profile.plan,
        planStatus: profile.plan_status,
        credits: profile.credits
      }
    });

  } catch (error) {
    console.error("[VESTRA ME] ERRO:", error);

    return res.status(500).json({
      error: error?.message || "Erro ao carregar o perfil."
    });
  }
}
