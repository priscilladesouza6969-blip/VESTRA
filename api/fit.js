const { fal } = await import("@fal-ai/client");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  try {
    const { personImage, garmentImages } = req.body || {};

    if (!personImage) {
      return res.status(400).json({
        error: "É necessário enviar a foto da pessoa."
      });
    }

    if (!Array.isArray(garmentImages) || garmentImages.length === 0) {
      return res.status(400).json({
        error: "É necessário enviar pelo menos uma peça."
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

    let currentPerson = personImage;

    for (let i = 0; i < garmentImages.length; i++) {
      const clothingImage = garmentImages[i];

      if (!clothingImage) continue;

      console.log(
        `[VESTRA FAL] Gerando peça ${i + 1} de ${garmentImages.length}...`
      );

      const result = await fal.subscribe(
        "fal-ai/image-apps-v2/virtual-try-on",
        {
          input: {
            person_image_url: currentPerson,
            clothing_image_url: clothingImage,
            preserve_pose: true,
            aspect_ratio: "3:4"
          },
          logs: true,
          onQueueUpdate: (update) => {
            console.log(
              "[VESTRA FAL] Status:",
              update?.status || "sem status"
            );
          }
        }
      );

      const imageUrl = result?.data?.images?.[0]?.url;

      if (!imageUrl) {
        console.error(
          "[VESTRA FAL] A FAL não retornou imagem para a peça",
          i + 1
        );

        return res.status(500).json({
          error: `A fal.ai não retornou uma imagem para a peça ${i + 1}.`
        });
      }

      currentPerson = imageUrl;
    }

    console.log("[VESTRA FAL] Look gerado com sucesso.");

    return res.status(200).json({
      success: true,
      imageUrl: currentPerson
    });

  } catch (error) {
    console.error("[VESTRA FAL] ERRO:", error);

    return res.status(500).json({
      error:
        (error?.status ? "Status " + error.status + ": " : "") +
        (error?.message || "Erro ao gerar o look.")
    });
  }
}
