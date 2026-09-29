import OpenAI from "openai";
import { guard } from "./_guard.js";
import { requireUser } from "./_auth.js";

const MAX_TEXT = 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  if (!guard(req, res, { name: "voice", limit: 20 })) return;

  if (!(await requireUser(req, res))) return;

  try {
    const { text } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Texto não enviado."
      });
    }

    if (text.length > MAX_TEXT) {
      return res.status(400).json({
        error: `Texto muito longo (máximo ${MAX_TEXT} caracteres).`
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("[VESTRA VOZ] OPENAI_API_KEY não configurada.");
      return res.status(500).json({
        error: "OPENAI_API_KEY não configurada no Vercel."
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: text,
      instructions:
        "Fale em português do Brasil com uma voz feminina elegante, natural, suave, moderna e amigável. Soe como uma assistente pessoal de moda premium. Não fale de forma robótica."
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);

    return res.status(200).send(buffer);

  } catch (error) {
    console.error("Erro na voz da VESTRA:", error);

    return res.status(500).json({
      error: error?.message || "Erro ao gerar a voz."
    });
  }
}