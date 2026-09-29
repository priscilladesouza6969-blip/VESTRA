import OpenAI from "openai";
import { guard } from "./_guard.js";

const DEFAULT_MODEL = "gpt-5.6-luna";

const ACTION_TYPES = [
  "open_view",
  "filter_closet",
  "favorite_piece",
  "clear_look",
  "create_look",
  "start_fitting",
  "save_look"
];

const VIEWS = [
  "home",
  "closet",
  "fitting",
  "look",
  "stylist",
  "measures",
  "plans",
  "suporte",
  "beauty",
  "partners",
  "creators",
  "profile"
];

// Formato fixo da resposta (Structured Outputs): o modelo sempre devolve
// {"reply": "...", "actions": [...]}, sem precisar extrair JSON do texto.
const RESPONSE_FORMAT = {
  type: "json_schema",
  name: "vestra_stylist_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "actions"],
    properties: {
      reply: { type: "string" },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "view", "query", "category", "pieceIds"],
          properties: {
            type: { type: "string", enum: ACTION_TYPES },
            view: { type: ["string", "null"] },
            query: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
            pieceIds: { type: "array", items: { type: "string" } }
          }
        }
      }
    }
  }
};

function text(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function describeCloset(closet) {
  if (!closet.length) return "closet vazio no momento";

  return closet
    .map((p) =>
      `- id "${p.id}": ${p.name} (${p.category || "peça"}, cor ${p.color || "—"}, tam ${p.size || "—"}${p.fav ? ", favorita" : ""})`
    )
    .join("\n");
}

function describeMeasures(m) {
  const keys = ["altura", "busto", "cintura", "quadril", "ombros", "tam"];

  if (!keys.some((k) => m[k])) return "ainda não informadas.";

  return `altura ${m.altura || "—"}cm, busto ${m.busto || "—"}cm, cintura ${m.cintura || "—"}cm, quadril ${m.quadril || "—"}cm, ombros ${m.ombros || "—"}cm, tamanho habitual ${m.tam || "—"}.`;
}

// Aceita tanto o formato novo {profile, closet} enviado pelo index.html
// quanto o formato antigo {styleMemory, actionContext}.
function normalizeBody(body) {
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};

  const closet = (Array.isArray(body.closet) ? body.closet : [])
    .slice(0, 60)
    .filter((p) => p && p.id)
    .map((p) => ({
      id: text(p.id, 60),
      name: text(p.name, 80) || "Peça sem nome",
      category: text(p.category || p.cat, 40),
      color: text(p.color, 40),
      size: text(p.size, 20),
      fav: !!p.fav
    }));

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-12)
    .map((m) => ({ role: m.role, content: text(m.content, 2000) }));

  return {
    message: text(body.message, 2000),
    history,
    closet,
    name: text(profile.name, 60),
    styleMemory: profile.styleMemory || body.styleMemory || {},
    measures: profile.measures && typeof profile.measures === "object" ? profile.measures : {},
    actionContext: body.actionContext && typeof body.actionContext === "object" ? body.actionContext : {}
  };
}

// Só deixa passar ações conhecidas, telas existentes e peças que estão no closet.
function sanitizeActions(actions, closetIds) {
  if (!Array.isArray(actions)) return [];

  return actions
    .filter((a) => a && ACTION_TYPES.includes(a.type))
    .map((a) => {
      const action = { type: a.type };

      if (a.type === "open_view") {
        if (!VIEWS.includes(a.view)) return null;
        action.view = a.view;
      }

      if (a.type === "filter_closet") {
        action.query = text(a.query, 60);
        action.category = text(a.category, 40);
      }

      if (["favorite_piece", "create_look", "start_fitting"].includes(a.type)) {
        action.pieceIds = (Array.isArray(a.pieceIds) ? a.pieceIds : [])
          .map(String)
          .filter((id) => closetIds.has(id));
        if (!action.pieceIds.length) return null;
      }

      return action;
    })
    .filter(Boolean)
    .slice(0, 3);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  if (!guard(req, res, { name: "stylist", limit: 30 })) return;

  try {
    const data = normalizeBody(req.body || {});

    if (!data.message) {
      return res.status(400).json({
        error: "Mensagem não enviada."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("[VESTRA AI] OPENAI_API_KEY não configurada.");
      return res.status(500).json({
        error: "OPENAI_API_KEY não configurada no Vercel."
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const model = process.env.VESTRA_AI_MODEL || DEFAULT_MODEL;

    const systemPrompt = `
Você é a VESTRA, uma assistente de moda pessoal integrada ao aplicativo VESTRA.

Seu objetivo é conversar naturalmente com a pessoa, entender seus gostos e ajudá-la a usar o aplicativo.

Você pode ajudar com:
- roupas e combinações;
- criação de looks;
- guarda-roupa digital;
- provador virtual;
- estilo pessoal;
- maquiagem e beleza;
- organização das peças;
- navegação dentro do VESTRA.

A VESTRA deve ser amigável, moderna, natural e objetiva.
Responda em português do Brasil, de forma curta (2 a 5 frases).
Leia o histórico da conversa e continue de onde parou; não repita perguntas já respondidas.
Quando montar looks, cite peças específicas do guarda-roupa abaixo. Nunca invente peças.
Em perguntas de tamanho, use as medidas informadas como estimativa.

Nome da pessoa: ${data.name || "não informado"}

Guarda-roupa da pessoa:
${describeCloset(data.closet)}

Preferências de estilo já aprendidas:
${JSON.stringify(data.styleMemory)}

Medidas: ${describeMeasures(data.measures)}

Contexto atual do aplicativo:
${JSON.stringify(data.actionContext)}

Responda sempre no formato {"reply": "...", "actions": [...]}.
Use "actions" apenas quando a pessoa pedir algo que a interface deve fazer; caso contrário, deixe a lista vazia.

Ações disponíveis (preencha com null ou [] os campos que não se aplicam):
- open_view: abre uma tela. "view" é uma de: ${VIEWS.join(", ")}.
- filter_closet: filtra o closet. Use "query" (texto) e/ou "category".
- favorite_piece: favorita peças. "pieceIds" com ids do guarda-roupa.
- create_look: monta um look no criador de looks. "pieceIds" com até 5 ids do guarda-roupa.
- start_fitting: leva peças ao provador. "pieceIds" com ids do guarda-roupa.
- clear_look: limpa o look atual.
- save_look: salva o look atual.
`;

    const input = [
      {
        role: "system",
        content: systemPrompt
      },
      ...data.history,
      {
        role: "user",
        content: data.message
      }
    ];

    const response = await client.responses.create({
      model,
      input,
      text: {
        format: RESPONSE_FORMAT
      }
    });

    const raw = response.output_text || "";

    let parsed = null;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    const reply =
      text(parsed?.reply, 4000) ||
      (parsed ? "" : text(raw, 4000)) ||
      "Desculpe, não consegui responder agora.";

    const actions = sanitizeActions(
      parsed?.actions,
      new Set(data.closet.map((p) => p.id))
    );

    return res.status(200).json({
      success: true,
      reply,
      actions,
      action: actions[0] || null
    });

  } catch (error) {
    console.error("Erro na VESTRA AI:", error);

    return res.status(500).json({
      error: error?.message || "Erro ao conversar com a VESTRA."
    });
  }
}
