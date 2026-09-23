const { fal } = await import("@fal-ai/client");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido"
    });
  }

  try {
    const { personImage, clothingImage } = req.body || {};

    if (!personImage || !clothingImage) {
      return res.status(400).json({
        error: "É necessário enviar a foto da pessoa e a foto da roupa."
      });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({
        error: "FAL_KEY não configurada no Vercel."
      });
    }

    fal.config({
      credentials: process.env.FAL_KEY
    });

    const result = await fal.subscribe(
      "fal-ai/image-apps-v2/virtual-try-on",
      {
        input: {
          person_image_url: personImage,
          clothing_image_url: clothingImage,
          preserve_pose: true,
          aspect_ratio: "3:4"
        }
      }
    );

    const imageUrl = result?.data?.images?.[0]?.url;

    if (!imageUrl) {
      return res.status(500).json({
        error: "A fal.ai não retornou uma imagem."
      });
    }

    return res.status(200).json({
      success: true,
      imageUrl
    });

  } catch (error) {
    console.error("Erro na geração:", error);

    return res.status(500).json({
      error: (error?.status ? "Status "+error.status+": " : "") + (error?.message || "Erro ao gerar o look.")
    });
  }

}
