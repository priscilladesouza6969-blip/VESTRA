export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido'
    });
  }

  try {
    const { name, email } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({
        error: 'Nome e e-mail são obrigatórios'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        error: 'E-mail inválido'
      });
    }

    return res.status(200).json({
      success: true,
      access: true,
      name: String(name).trim(),
      email: normalizedEmail
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Não foi possível realizar o cadastro'
    });
  }
}