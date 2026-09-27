document.addEventListener('DOMContentLoaded', () => {
  const gate = document.getElementById('earlyAccessGate');
  const form = document.getElementById('earlyAccessForm');
  const status = document.getElementById('earlyAccessStatus');

  if (!gate || !form) return;

  const accessGranted =
    localStorage.getItem('vestra_early_access') === 'true';

  if (accessGranted) {
    gate.style.display = 'none';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('earlyName').value.trim();
    const email = document.getElementById('earlyEmail').value.trim();

    if (!name || !email) return;

    status.textContent = 'Entrando na lista...';

    try {
      const response = await fetch('/api/early-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro no cadastro');
      }

      localStorage.setItem('vestra_early_access', 'true');
      localStorage.setItem('vestra_early_access_name', data.name);
      localStorage.setItem('vestra_early_access_email', data.email);

      status.textContent = 'Acesso liberado.';

      setTimeout(() => {
        gate.style.display = 'none';
      }, 500);

    } catch (error) {
      status.textContent =
        error.message || 'Não foi possível realizar o cadastro.';
    }
  });
});