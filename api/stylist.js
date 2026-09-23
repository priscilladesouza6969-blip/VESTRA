import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  try {
    const {
      message,
      history = [],
      styleMemory = {},
      actionContext = {}
    } = req.body || {};

    if (!message) {
      return res.status(400).json({
        error: "Mensagem não enviada."
      });
    }

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
Ela deve aprender com as preferências informadas pela pessoa.

Preferências conhecidas da pessoa:
${JSON.stringify(styleMemory)}

Contexto atual do aplicativo:
${JSON.stringify(actionContext)}

Quando a pessoa pedir uma ação dentro do aplicativo, responda de forma curta e informe a ação em JSON no final.

Formato de ação:
{"type":"open_view","view":"closet"}

Ações disponíveis:
- open_view
- filter_closet
- favorite_piece
- clear_look
- create_look
- start_fitting
- save_look

Se não for necessário executar uma ação, não gere JSON de ação.
`;

    const input = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history.slice(-12),
      {
        role: "user",
        content: message
      }
    ];

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      input
    });

    const text = response.output_text || "Desculpe, não consegui responder agora.";

    let action = null;

    const jsonMatch = text.match(/\{[\s\S]*"type"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        action = JSON.parse(jsonMatch[0]);
      } catch {
        action = null;
      }
    }

    const cleanText = text
      .replace(/\{[\s\S]*"type"[\s\S]*\}/, "")
      .trim();

    return res.status(200).json({
      success: true,
      reply: cleanText || text,
      action
    });

  } catch (error) {
    console.error("Erro na VESTRA AI:", error);

    return res.status(500).json({
      error: error?.message || "Erro ao conversar com a VESTRA."
    });
  }
}