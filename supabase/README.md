# VESTRA — configuração do Supabase

Passo a passo para ligar o login, o banco e as imagens do app (`/app/`).

## 1. Criar o projeto
1. Em https://supabase.com crie um projeto na região **South America (São Paulo)**.
2. Guarde a senha do banco num lugar seguro.

## 2. Criar as tabelas e regras
1. No painel do projeto, abra **SQL Editor → New query**.
2. Cole todo o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.

O script pode ser rodado de novo sem apagar dados. Ele cria:
- `profiles`: perfil de cada pessoa, com papel (`user`/`owner`), início do teste grátis, plano e créditos;
- `closet_items` e `looks`;
- o bucket **privado** `vestra` para as fotos;
- as regras de acesso (RLS): cada pessoa só vê e altera os próprios dados e fotos.

## 3. Login por e-mail e senha
Em **Authentication → Sign In / Providers → Email**:
- deixe **Enable Email provider** ligado;
- deixe **Confirm email** ligado. Isso é obrigatório para o papel de OWNER funcionar com segurança.

## 4. Login com Google
1. No Google Cloud Console (https://console.cloud.google.com), em **APIs e serviços → Credenciais**, crie um **ID do cliente OAuth** do tipo **Aplicativo da Web**.
2. Em **URIs de redirecionamento autorizados**, adicione:
   `https://<ID-DO-PROJETO>.supabase.co/auth/v1/callback`
3. No Supabase, em **Authentication → Sign In / Providers → Google**, ligue o provedor e cole o **Client ID** e o **Client Secret**.

## 5. Endereços permitidos
Em **Authentication → URL Configuration**:
- **Site URL**: o endereço de produção, ex.: `https://vestra.vercel.app`
- **Redirect URLs**: adicione
  - `https://vestra.vercel.app/app/` (e o domínio próprio, se houver)
  - `https://*-<seu-time>.vercel.app/app/` (para os previews da Vercel)
  - `http://localhost:3000/app/` (para testes locais com `vercel dev`)

## 6. Variáveis na Vercel
Em **Vercel → projeto vestra → Settings → Environment Variables**, marque **Production** e **Preview** para cada uma:

| Variável | Onde encontrar | Observação |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | pública |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → `anon` / publishable | pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` / secret | **secreta**: só na Vercel, nunca no HTML |
| `OWNER_EMAIL` | o seu e-mail de login | aceita vários, separados por vírgula |

Depois de salvar, faça um novo deploy para as variáveis valerem.

## Como o app usa isso
- `/api/config` entrega ao navegador só a URL e a chave pública.
- As rotas `/api/fit`, `/api/stylist`, `/api/voice` e `/api/generate-fitting` exigem login.
- `/api/me` define o papel **OWNER** para quem entra com o e-mail de `OWNER_EMAIL` (com e-mail confirmado).
- Na primeira entrada em cada aparelho, o closet, os looks e as medidas que estavam só no navegador são enviados para a conta.
