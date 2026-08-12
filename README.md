# STNB — Portal do Aluno/Staff

Checklist de configuração manual necessária antes de rodar este app contra serviços reais (Supabase, Firebase, Google OAuth e Google Drive).

## Checklist de setup

1. **Instalar dependências**

   ```bash
   npm install
   ```

2. **Supabase**
   - Crie um projeto no [Supabase](https://supabase.com).
   - Aplique as migrações `supabase/migrations/0001_init.sql` e `supabase/migrations/0002_academico.sql` pelo SQL Editor do projeto (ou, se a CLI já estiver linkada ao projeto, rode `supabase db push`).

3. **Firebase**
   - Crie um projeto no [Firebase Console](https://console.firebase.google.com).
   - Habilite o provedor de login **E-mail/Senha** (Authentication → Sign-in method).
   - Registre um **Web App** no projeto e copie `apiKey`, `authDomain` e `projectId`.
   - Gere uma **chave de conta de serviço** (Project Settings → Service Accounts → Generate new private key).

4. **Google Cloud OAuth Client ID (login do staff)**
   - Crie um **OAuth Client ID** do tipo *Web application* no Google Cloud Console.
   - Adicione a URI de redirecionamento `http://localhost:3000/api/auth/callback/google` para desenvolvimento local.

5. **Google Cloud Service Account (acesso ao Drive)**
   - Crie uma **conta de serviço** no Google Cloud e habilite a **Drive API**.
   - Configure a **delegação em todo o domínio** (domain-wide delegation) no Google Workspace Admin Console (Security → API Controls → Domain-wide Delegation), com o escopo `https://www.googleapis.com/auth/drive`.

6. **Variáveis de ambiente**
   - Copie `.env.local.example` para `.env.local`.
   - Preencha todos os valores obtidos nos passos acima.
   - Gere `AUTH_SECRET` com:

     ```bash
     npx auth secret
     ```

   - Preencha `WORKSPACE_DOMAIN` com o domínio do Google Workspace da instituição.

7. **Rodar e verificar manualmente**

   ```bash
   npm run dev
   ```

   Verifique manualmente:
   - Login do staff via Google OAuth em `/staff/login`
   - Login do aluno em `/aluno/login`
   - Fluxo de Matrícula em `/aluno/matricula`

   Consulte a Task 9 do plano (`docs/superpowers/plans/2026-08-12-fundacao-app-seminario.md`) para o roteiro de teste manual detalhado.

## Nota — Safari e cookies de sessão do aluno

O cookie de sessão do aluno é definido com `secure: true`. Chrome e Firefox permitem esse cookie sobre `http://localhost`, mas **o Safari não permite**. Testar o login do aluno localmente no Safari falha silenciosamente (resposta 200, cookie não é definido, redirecionamento de volta para `/aluno/login` em loop). Use Chrome ou Firefox para testes locais, ou sirva a aplicação via HTTPS.
