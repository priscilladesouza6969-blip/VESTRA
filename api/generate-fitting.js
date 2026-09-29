const { fal } = await import("@fal-ai/client");
import { guard, isImageInput } from "./_guard.js";
import { requireUser } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  if (!guard(req, res, { name: "generate-fitting", limit: 6 })) return;

  if (!(await requireUser(req, res))) return;

  try {
    const { personImage, clothingImage } = req.body || {};

    if (!personImage || !clothingImage) {
      return res.status(400).json({
        error: "É necessário enviar a foto da pessoa e a foto da roupa."
      });
    }

    if (!isImageInput(personImage) || !isImageInput(clothingImage)) {
      return res.status(400).json({
        error: "Imagem inválida. Envie fotos em JPG, PNG ou WEBP."
      });
    }

    if (!process.env.FAL_KEY) {
      console.error("[VESTRA FAL] FAL_KEY não configurada.");
      return res.status(500).json({
        error: "FAL_KEY não configurada no Vercel."
      });
    }

    fal.config({
      credentials: process.env.FAL_KEY
    });

    console.log("[VESTRA FAL] Iniciando virtual try-on...");

    const result = await fal.subscribe(
      "fal-ai/image-apps-v2/virtual-try-on",
      {
        input: {
          person_image_url: personImage,
          clothing_image_url: clothingImage,
          preserve_pose: true,
          aspect_ratio: "3:4"
        },
        logs: true,
        onQueueUpdate: (update) => {
          console.log(
            "[VESTRA FAL] Queue update:",
            update?.status || "sem status"
          );
        }
      }
    );

    console.log(
      "[VESTRA FAL] Resposta recebida:",
      JSON.stringify(result?.data || result)
    );

    const imageUrl = result?.data?.images?.[0]?.url;

    if (!imageUrl) {
      console.error(
        "[VESTRA FAL] Nenhuma imagem encontrada na resposta."
      );

      return res.status(500).json({
        error: "A fal.ai não retornou uma imagem.",
        debug: {
          hasData: !!result?.data,
          keys: result?.data ? Object.keys(result.data) : []
        }
      });
    }

    console.log("[VESTRA FAL] Imagem gerada com sucesso.");

    return res.status(200).json({
      success: true,
      imageUrl
    });

  } catch (error) {
    console.error("[VESTRA FAL] ERRO:", error);
    console.error(
      "[VESTRA FAL] Mensagem:",
      error?.message || "sem mensagem"
    );
    console.error(
      "[VESTRA FAL] Status:",
      error?.status || "sem status"
    );

    return res.status(500).json({
      error:
        (error?.status ? "Status " + error.status + ": " : "") +
        (error?.message || "Erro ao gerar o look.")
    });
  }
}
