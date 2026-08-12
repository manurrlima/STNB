# Fundação do App do Seminário (STNB Polo Recife) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a base do app (Fase 1 do spec): autenticação de aluno (Firebase Auth) e de staff (Google OAuth restrito ao domínio do Workspace), schema do banco no Supabase, geração de RA com criação automática de pasta no Google Drive, e o fluxo de Matrícula anual.

**Architecture:** Next.js (App Router, TypeScript) hospedado no Vercel. Todo acesso a dados passa por Route Handlers/Server Actions no servidor, usando o Supabase **service role key** (nunca a anon key no cliente) — a autorização por papel é sempre checada no servidor antes de qualquer leitura/escrita. RLS é habilitado em todas as tabelas **sem políticas** (deny-by-default): isso funciona como camada extra de proteção, já que só a service role (usada exclusivamente no servidor) consegue ler/escrever — se a anon key vazar ou for usada por engano no cliente, nada é acessível. Dois provedores de identidade, unificados por um helper `getCurrentUser()`: NextAuth (Auth.js v5) com Google provider para financeiro/pedagógico, e Firebase Auth (com um cookie de sessão httpOnly assinado pelo Firebase Admin) para alunos.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Supabase (Postgres), NextAuth v5 (`next-auth@beta`), Firebase Auth (`firebase` + `firebase-admin`), Google Drive API (`googleapis`), Vitest para testes.

## Global Constraints

- Frontend + backend em Next.js (App Router), hospedado no Vercel (free tier).
- Banco de dados PostgreSQL via Supabase (free tier), com Row Level Security habilitado.
- Alunos autenticam via Firebase Auth (email/senha).
- Pedagógico e Financeiro autenticam via Google OAuth restrito ao domínio do Google Workspace do seminário.
- RA é gerado uma única vez, na primeira Matrícula do aluno, e nunca muda.
- Ao gerar o RA, o sistema cria automaticamente uma pasta no Google Drive nomeada `RA - Nome do Aluno`.
- Orçamento mensal alvo: até R$300, idealmente próximo de zero fora de taxas de transação.
- Testes automatizados priorizam regras de bloqueio/gating (aqui: geração de RA e unicidade de matrícula por ano) — é onde um bug é caro e silencioso.

---

### Task 1: Scaffolding do projeto Next.js + Vitest

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `.env.local.example`
- Create: `.gitignore`

**Interfaces:**
- Produces: alias `@/*` resolvendo para a raiz do projeto (usado por todas as tasks seguintes em imports como `@/lib/...`).

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "stnb-app",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.4.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "5.0.0-beta.25",
    "firebase": "^11.0.0",
    "firebase-admin": "^13.0.0",
    "googleapis": "^144.0.0",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run: `npm install`
Expected: instala sem erro, cria `package-lock.json`.

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Criar `next.config.ts`**

```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 5: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
```

- [ ] **Step 6: Criar `app/layout.tsx` e `app/page.tsx`**

```tsx
// app/layout.tsx
export const metadata = {
  title: "STNB Polo Recife",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/page.tsx
export default function HomePage() {
  return <p>STNB Polo Recife</p>
}
```

- [ ] **Step 7: Criar `.env.local.example`**

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Firebase (cliente, pode ser público)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

# Firebase Admin (servidor, secreto)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# NextAuth / Google OAuth (staff)
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
WORKSPACE_DOMAIN=stnbnec.com

# Google Drive (conta de serviço com delegação de domínio)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_WORKSPACE_IMPERSONATE_EMAIL=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

- [ ] **Step 8: Criar `.gitignore`**

```
node_modules
.next
.env.local
*.local
```

- [ ] **Step 9: Verificar que o projeto builda**

Run: `npx tsc --noEmit`
Expected: nenhum erro de tipo.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts app .env.local.example .gitignore
git commit -m "chore: scaffold Next.js project with Vitest"
```

---

### Task 2: Cliente Supabase (admin) + schema do banco

**Files:**
- Create: `lib/supabase/admin.ts`
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: `supabaseAdmin` (cliente `@supabase/supabase-js` com service role key) — usado por todas as tasks que leem/escrevem no banco.
- Produces (schema): tabelas `usuarios(id, tipo, email, external_id, criado_em)`, `alunos(usuario_id, ra, nome, polo, drive_folder_id, criado_em)`, `matriculas(id, aluno_id, ano, confirmada_em)`; função `proximo_valor_ra_seq(): integer`.

- [ ] **Step 1: Criar `lib/supabase/admin.ts`**

```ts
import { createClient } from "@supabase/supabase-js"

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
)
```

- [ ] **Step 2: Criar `supabase/migrations/0001_init.sql`**

```sql
create extension if not exists "pgcrypto";

create type tipo_usuario as enum ('aluno', 'pedagogico', 'financeiro');

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_usuario not null,
  email text not null unique,
  external_id text not null unique,
  criado_em timestamptz not null default now()
);

create table alunos (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  ra text unique,
  nome text not null,
  polo text not null default 'recife',
  drive_folder_id text,
  criado_em timestamptz not null default now()
);

create table matriculas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(usuario_id) on delete cascade,
  ano integer not null,
  confirmada_em timestamptz not null default now(),
  unique (aluno_id, ano)
);

create sequence ra_seq start 1;

create function proximo_valor_ra_seq()
returns integer
language sql
as $$
  select nextval('ra_seq')::integer;
$$;

alter table usuarios enable row level security;
alter table alunos enable row level security;
alter table matriculas enable row level security;
```

- [ ] **Step 3: Aplicar a migration no Supabase**

Abra o painel do projeto Supabase → SQL Editor → cole o conteúdo de `supabase/migrations/0001_init.sql` → Run. (Ou, se o Supabase CLI estiver linkado ao projeto: `supabase db push`.)
Expected: as 3 tabelas, o enum, a sequence e a função aparecem em Table Editor / Database sem erro.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/admin.ts supabase/migrations/0001_init.sql
git commit -m "feat: add Supabase admin client and base schema"
```

---

### Task 3: Restrição de domínio do Workspace (função pura + testes)

**Files:**
- Create: `lib/auth/workspace.ts`
- Test: `tests/lib/auth/workspace.test.ts`

**Interfaces:**
- Produces: `isWorkspaceEmail(email: string | undefined | null, domain: string): boolean` — usado pelo `signIn` callback do NextAuth na Task 4.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/auth/workspace.test.ts
import { describe, expect, it } from "vitest"
import { isWorkspaceEmail } from "@/lib/auth/workspace"

describe("isWorkspaceEmail", () => {
  it("aceita e-mail do domínio do Workspace", () => {
    expect(isWorkspaceEmail("financeiro@stnbnec.com", "stnbnec.com")).toBe(true)
  })

  it("rejeita e-mail de outro domínio", () => {
    expect(isWorkspaceEmail("qualquer@gmail.com", "stnbnec.com")).toBe(false)
  })

  it("rejeita e-mail undefined ou vazio", () => {
    expect(isWorkspaceEmail(undefined, "stnbnec.com")).toBe(false)
    expect(isWorkspaceEmail("", "stnbnec.com")).toBe(false)
  })

  it("não aceita domínio como substring solta (ex: naostnbnec.com)", () => {
    expect(isWorkspaceEmail("financeiro@naostnbnec.com", "stnbnec.com")).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/auth/workspace.test.ts`
Expected: FAIL com "Cannot find module '@/lib/auth/workspace'".

- [ ] **Step 3: Implementar**

```ts
// lib/auth/workspace.ts
export function isWorkspaceEmail(email: string | undefined | null, domain: string): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/auth/workspace.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/workspace.ts tests/lib/auth/workspace.test.ts
git commit -m "feat: add workspace email domain check"
```

---

### Task 4: Login do financeiro/pedagógico (NextAuth + Google OAuth)

**Files:**
- Create: `auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/staff/login/page.tsx`

**Interfaces:**
- Consumes: `isWorkspaceEmail` de `@/lib/auth/workspace` (Task 3).
- Produces: `auth()` (helper server-side do NextAuth para ler a sessão atual) e `signIn`/`signOut` — usados pelo `getCurrentUser()` na Task 6.

- [ ] **Step 1: Criar `auth.ts`**

```ts
// auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { isWorkspaceEmail } from "@/lib/auth/workspace"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ profile }) {
      const domain = process.env.WORKSPACE_DOMAIN
      if (!domain) return false
      return isWorkspaceEmail(profile?.email, domain)
    },
  },
})
```

- [ ] **Step 2: Criar a rota de API do NextAuth**

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

- [ ] **Step 3: Criar a tela de login do staff**

```tsx
// app/staff/login/page.tsx
import { signIn } from "@/auth"

export default function StaffLoginPage() {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("google", { redirectTo: "/" })
      }}
    >
      <button type="submit">Entrar com conta do Google Workspace</button>
    </form>
  )
}
```

- [ ] **Step 4: Configurar credenciais no `.env.local`**

No Google Cloud Console, crie um OAuth Client ID (tipo "Web application") com redirect URI `http://localhost:3000/api/auth/callback/google` (ajustar para o domínio de produção depois). Preencha no `.env.local`: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` (gerar com `npx auth secret`), `WORKSPACE_DOMAIN=stnbnec.com`.
Expected: variáveis presentes em `.env.local` (não commitado).

- [ ] **Step 5: Commit**

```bash
git add auth.ts "app/api/auth/[...nextauth]/route.ts" app/staff/login/page.tsx
git commit -m "feat: add staff Google OAuth login restricted to Workspace domain"
```

---

### Task 5: Login do aluno (Firebase Auth + cookie de sessão)

**Files:**
- Create: `lib/firebase/client.ts`
- Create: `lib/firebase/admin.ts`
- Create: `app/aluno/login/page.tsx`
- Create: `app/api/auth/aluno-session/route.ts`
- Test: `tests/app/api/auth/aluno-session.test.ts`

**Interfaces:**
- Produces: `firebaseAuth` (Firebase Admin Auth, servidor) — usado por `getCurrentUser()` na Task 6.
- Produces: cookie httpOnly `aluno_session` — lido por `getCurrentUser()` na Task 6.

- [ ] **Step 1: Criar `lib/firebase/client.ts`**

```ts
// lib/firebase/client.ts
import { getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)
export const firebaseClientAuth = getAuth(firebaseApp)
```

- [ ] **Step 2: Criar `lib/firebase/admin.ts`**

```ts
// lib/firebase/admin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

function getFirebaseAdminApp() {
  const existing = getApps()
  if (existing.length) return existing[0]!
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}

export const firebaseAuth = getAuth(getFirebaseAdminApp())
```

- [ ] **Step 3: Escrever o teste que falha para a rota de sessão**

```ts
// tests/app/api/auth/aluno-session.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const verifyIdTokenMock = vi.fn()
const createSessionCookieMock = vi.fn()

vi.mock("@/lib/firebase/admin", () => ({
  firebaseAuth: {
    verifyIdToken: verifyIdTokenMock,
    createSessionCookie: createSessionCookieMock,
  },
}))

describe("POST /api/auth/aluno-session", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset()
    createSessionCookieMock.mockReset()
  })

  it("retorna 400 quando idToken não é enviado", async () => {
    const { POST } = await import("@/app/api/auth/aluno-session/route")
    const request = new Request("http://localhost/api/auth/aluno-session", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("retorna 401 quando o token é inválido", async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error("invalid"))
    const { POST } = await import("@/app/api/auth/aluno-session/route")
    const request = new Request("http://localhost/api/auth/aluno-session", {
      method: "POST",
      body: JSON.stringify({ idToken: "token-invalido" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it("cria o cookie de sessão quando o token é válido", async () => {
    verifyIdTokenMock.mockResolvedValueOnce({ uid: "uid-123" })
    createSessionCookieMock.mockResolvedValueOnce("cookie-assinado")
    const { POST } = await import("@/app/api/auth/aluno-session/route")
    const request = new Request("http://localhost/api/auth/aluno-session", {
      method: "POST",
      body: JSON.stringify({ idToken: "token-valido" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain("aluno_session=cookie-assinado")
  })
})
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/app/api/auth/aluno-session.test.ts`
Expected: FAIL com "Cannot find module '@/app/api/auth/aluno-session/route'".

- [ ] **Step 5: Implementar a rota**

```ts
// app/api/auth/aluno-session/route.ts
import { NextResponse } from "next/server"
import { firebaseAuth } from "@/lib/firebase/admin"

const SESSION_COOKIE_NAME = "aluno_session"
const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000 // 5 dias

export async function POST(request: Request) {
  const body = await request.json()
  const idToken = body?.idToken

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "idToken obrigatório" }, { status: 400 })
  }

  try {
    await firebaseAuth.verifyIdToken(idToken)
    const sessionCookie = await firebaseAuth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: EXPIRES_IN_MS / 1000,
      path: "/",
    })
    return response
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 })
  }
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/app/api/auth/aluno-session.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 7: Criar a tela de login do aluno**

```tsx
// app/aluno/login/page.tsx
"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { firebaseClientAuth } from "@/lib/firebase/client"

export default function AlunoLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    try {
      const credencial = await signInWithEmailAndPassword(firebaseClientAuth, email, senha)
      const idToken = await credencial.user.getIdToken()
      const response = await fetch("/api/auth/aluno-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })
      if (!response.ok) throw new Error("Falha ao criar sessão")
      router.push("/aluno")
    } catch {
      setErro("E-mail ou senha inválidos.")
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required />
      <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" required />
      {erro && <p role="alert">{erro}</p>}
      <button type="submit">Entrar</button>
    </form>
  )
}
```

- [ ] **Step 8: Configurar o projeto Firebase**

No Console do Firebase, crie um projeto, habilite o provedor "Email/senha" em Authentication, gere uma Web App (copie `apiKey`, `authDomain`, `projectId` para `NEXT_PUBLIC_FIREBASE_*`), e gere uma chave de conta de serviço (Project Settings → Service Accounts → Generate new private key) para preencher `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
Expected: variáveis presentes em `.env.local`.

- [ ] **Step 9: Commit**

```bash
git add lib/firebase app/aluno/login/page.tsx "app/api/auth/aluno-session/route.ts" tests/app/api/auth/aluno-session.test.ts
git commit -m "feat: add student Firebase Auth login with session cookie"
```

---

### Task 6: Sessão unificada (`getCurrentUser`) + proteção de rotas

**Files:**
- Create: `lib/auth/current-user.ts`
- Create: `middleware.ts`
- Test: `tests/lib/auth/current-user.test.ts`

**Interfaces:**
- Consumes: `auth()` de `@/auth` (Task 4), `firebaseAuth` de `@/lib/firebase/admin` (Task 5), `supabaseAdmin` de `@/lib/supabase/admin` (Task 2).
- Produces: `getCurrentUser(): Promise<CurrentUser | null>` onde `CurrentUser = { usuarioId: string; papel: "aluno" | "pedagogico" | "financeiro"; email: string }` — todo Server Action/Route Handler das próximas fases deve chamar isso antes de acessar dados.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/auth/current-user.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const authMock = vi.fn()
const verifySessionCookieMock = vi.fn()
const cookiesGetMock = vi.fn()
const supabaseMaybeSingleMock = vi.fn()

vi.mock("@/auth", () => ({ auth: authMock }))
vi.mock("@/lib/firebase/admin", () => ({
  firebaseAuth: { verifySessionCookie: verifySessionCookieMock },
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGetMock }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: supabaseMaybeSingleMock }),
      }),
    }),
  },
}))

describe("getCurrentUser", () => {
  beforeEach(() => {
    authMock.mockReset()
    verifySessionCookieMock.mockReset()
    cookiesGetMock.mockReset()
    supabaseMaybeSingleMock.mockReset()
  })

  it("retorna usuário de staff quando há sessão NextAuth com papel válido", async () => {
    authMock.mockResolvedValueOnce({ user: { email: "financeiro@stnbnec.com" } })
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { id: "id-financeiro", tipo: "financeiro", email: "financeiro@stnbnec.com" },
    })

    const { getCurrentUser } = await import("@/lib/auth/current-user")
    const usuario = await getCurrentUser()

    expect(usuario).toEqual({ usuarioId: "id-financeiro", papel: "financeiro", email: "financeiro@stnbnec.com" })
  })

  it("retorna null quando não há sessão NextAuth nem cookie de aluno", async () => {
    authMock.mockResolvedValueOnce(null)
    cookiesGetMock.mockReturnValueOnce(undefined)

    const { getCurrentUser } = await import("@/lib/auth/current-user")
    const usuario = await getCurrentUser()

    expect(usuario).toBeNull()
  })

  it("retorna usuário aluno quando o cookie de sessão é válido", async () => {
    authMock.mockResolvedValueOnce(null)
    cookiesGetMock.mockReturnValueOnce({ value: "cookie-valido" })
    verifySessionCookieMock.mockResolvedValueOnce({ uid: "uid-123" })
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { id: "id-aluno", tipo: "aluno", email: "aluno@example.com" },
    })

    const { getCurrentUser } = await import("@/lib/auth/current-user")
    const usuario = await getCurrentUser()

    expect(usuario).toEqual({ usuarioId: "id-aluno", papel: "aluno", email: "aluno@example.com" })
  })

  it("retorna null quando o cookie de sessão é inválido", async () => {
    authMock.mockResolvedValueOnce(null)
    cookiesGetMock.mockReturnValueOnce({ value: "cookie-invalido" })
    verifySessionCookieMock.mockRejectedValueOnce(new Error("invalid"))

    const { getCurrentUser } = await import("@/lib/auth/current-user")
    const usuario = await getCurrentUser()

    expect(usuario).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/auth/current-user.test.ts`
Expected: FAIL com "Cannot find module '@/lib/auth/current-user'".

- [ ] **Step 3: Implementar**

```ts
// lib/auth/current-user.ts
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { firebaseAuth } from "@/lib/firebase/admin"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type CurrentUser = {
  usuarioId: string
  papel: "aluno" | "pedagogico" | "financeiro"
  email: string
}

const ALUNO_SESSION_COOKIE = "aluno_session"

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const staffSession = await auth()
  if (staffSession?.user?.email) {
    const { data } = await supabaseAdmin
      .from("usuarios")
      .select("id, tipo, email")
      .eq("email", staffSession.user.email)
      .maybeSingle()

    if (data && (data.tipo === "pedagogico" || data.tipo === "financeiro")) {
      return { usuarioId: data.id, papel: data.tipo, email: data.email }
    }
    return null
  }

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(ALUNO_SESSION_COOKIE)?.value
  if (!sessionCookie) return null

  try {
    const decoded = await firebaseAuth.verifySessionCookie(sessionCookie)
    const { data } = await supabaseAdmin
      .from("usuarios")
      .select("id, tipo, email")
      .eq("external_id", decoded.uid)
      .maybeSingle()

    if (data && data.tipo === "aluno") {
      return { usuarioId: data.id, papel: "aluno", email: data.email }
    }
    return null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/auth/current-user.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Criar `middleware.ts`**

Proteção de rota é uma checagem grosseira (presença de cookie) para redirecionar visitantes claramente deslogados antes de renderizar a página; a autorização de verdade (papel correto) é sempre feita por `getCurrentUser()` dentro de cada Server Action/Route Handler, porque `firebase-admin` e `googleapis` exigem runtime Node.js (não rodam no Edge, onde o middleware executa).

```ts
// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const STAFF_PREFIXES = ["/pedagogico", "/financeiro"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/aluno") && pathname !== "/aluno/login") {
    const hasSession = request.cookies.has("aluno_session")
    if (!hasSession) {
      return NextResponse.redirect(new URL("/aluno/login", request.url))
    }
  }

  if (STAFF_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const hasSession =
      request.cookies.has("authjs.session-token") || request.cookies.has("__Secure-authjs.session-token")
    if (!hasSession) {
      return NextResponse.redirect(new URL("/staff/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/aluno/:path*", "/pedagogico/:path*", "/financeiro/:path*"],
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/auth/current-user.ts middleware.ts tests/lib/auth/current-user.test.ts
git commit -m "feat: add unified session helper and route protection middleware"
```

---

### Task 7: Geração de RA + pasta no Google Drive

**Files:**
- Create: `lib/ra/generate.ts`
- Test: `tests/lib/ra/generate.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin` de `@/lib/supabase/admin` (Task 2).
- Produces: `gerarRA(alunoId: string, nomeAluno: string): Promise<{ ra: string; driveFolderId: string }>` — usado pela Task 8. `formatarRA(ano: number, sequencia: number): string`, formato `RA-{ano}-{sequência com 4 dígitos}` (ex: `RA-2026-0001`).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/ra/generate.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const rpcMock = vi.fn()
const updateEqMock = vi.fn()
const filesCreateMock = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: rpcMock,
    from: () => ({
      update: () => ({ eq: updateEqMock }),
    }),
  },
}))

vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: vi.fn().mockImplementation(() => ({})) },
    drive: () => ({ files: { create: filesCreateMock } }),
  },
}))

describe("gerarRA", () => {
  beforeEach(() => {
    rpcMock.mockReset()
    updateEqMock.mockReset()
    filesCreateMock.mockReset()
  })

  it("formata o RA como RA-{ano}-{sequência com 4 dígitos}, cria a pasta no Drive e salva no aluno", async () => {
    rpcMock.mockResolvedValueOnce({ data: 7, error: null })
    filesCreateMock.mockResolvedValueOnce({ data: { id: "drive-folder-id-123" } })
    updateEqMock.mockResolvedValueOnce({ error: null })

    const { gerarRA } = await import("@/lib/ra/generate")
    const ano = new Date().getFullYear()
    const resultado = await gerarRA("aluno-id-1", "Fulano de Tal")

    expect(resultado).toEqual({ ra: `RA-${ano}-0007`, driveFolderId: "drive-folder-id-123" })
    expect(filesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: `RA-${ano}-0007 - Fulano de Tal`,
          mimeType: "application/vnd.google-apps.folder",
        }),
      })
    )
  })

  it("lança erro se a sequência de RA não puder ser gerada", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "falha no banco" } })

    const { gerarRA } = await import("@/lib/ra/generate")

    await expect(gerarRA("aluno-id-1", "Fulano de Tal")).rejects.toThrow("Falha ao gerar sequência de RA")
  })

  it("lança erro se o Google Drive não retornar o id da pasta", async () => {
    rpcMock.mockResolvedValueOnce({ data: 8, error: null })
    filesCreateMock.mockResolvedValueOnce({ data: {} })

    const { gerarRA } = await import("@/lib/ra/generate")

    await expect(gerarRA("aluno-id-1", "Fulano de Tal")).rejects.toThrow(
      "Google Drive não retornou o id da pasta criada"
    )
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/ra/generate.test.ts`
Expected: FAIL com "Cannot find module '@/lib/ra/generate'".

- [ ] **Step 3: Implementar**

```ts
// lib/ra/generate.ts
import { google } from "googleapis"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type GerarRAResult = { ra: string; driveFolderId: string }

export function formatarRA(ano: number, sequencia: number): string {
  return `RA-${ano}-${String(sequencia).padStart(4, "0")}`
}

async function criarPastaNoDrive(nomeAluno: string, ra: string): Promise<string> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    subject: process.env.GOOGLE_WORKSPACE_IMPERSONATE_EMAIL,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
  const drive = google.drive({ version: "v3", auth })

  const response = await drive.files.create({
    requestBody: {
      name: `${ra} - ${nomeAluno}`,
      mimeType: "application/vnd.google-apps.folder",
      parents: [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID as string],
    },
    fields: "id",
  })

  if (!response.data.id) throw new Error("Google Drive não retornou o id da pasta criada")
  return response.data.id
}

export async function gerarRA(alunoId: string, nomeAluno: string): Promise<GerarRAResult> {
  const ano = new Date().getFullYear()
  const { data: sequencia, error } = await supabaseAdmin.rpc("proximo_valor_ra_seq")
  if (error || typeof sequencia !== "number") {
    throw new Error(`Falha ao gerar sequência de RA: ${error?.message ?? "resultado inválido"}`)
  }

  const ra = formatarRA(ano, sequencia)
  const driveFolderId = await criarPastaNoDrive(nomeAluno, ra)

  const { error: updateError } = await supabaseAdmin
    .from("alunos")
    .update({ ra, drive_folder_id: driveFolderId })
    .eq("usuario_id", alunoId)

  if (updateError) {
    throw new Error(`Falha ao salvar RA gerado: ${updateError.message}`)
  }

  return { ra, driveFolderId }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/ra/generate.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Configurar a conta de serviço do Google**

No Google Cloud Console (mesmo projeto do OAuth da Task 4 ou um novo), crie uma conta de serviço, habilite a Google Drive API, gere uma chave JSON, e configure a delegação de domínio inteiro no Admin Console do Workspace (Segurança → Controles de API → Delegação em todo o domínio) com o escopo `https://www.googleapis.com/auth/drive`. Preencha `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_WORKSPACE_IMPERSONATE_EMAIL` (um usuário real do Workspace a ser impersonado) e `GOOGLE_DRIVE_ROOT_FOLDER_ID` (id da pasta raiz onde as pastas dos alunos serão criadas) no `.env.local`.
Expected: variáveis presentes em `.env.local`.

- [ ] **Step 6: Commit**

```bash
git add lib/ra/generate.ts tests/lib/ra/generate.test.ts
git commit -m "feat: add RA generation with Google Drive folder creation"
```

---

### Task 8: Fluxo de Matrícula anual

**Files:**
- Create: `app/aluno/matricula/actions.ts`
- Create: `app/aluno/matricula/page.tsx`
- Test: `tests/app/aluno/matricula/actions.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 6), `gerarRA` (Task 7), `supabaseAdmin` (Task 2).
- Produces: `confirmarMatricula(): Promise<{ ok: true; ra: string } | { ok: false; erro: string }>`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/app/aluno/matricula/actions.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const getCurrentUserMock = vi.fn()
const gerarRAMock = vi.fn()
const matriculaMaybeSingleMock = vi.fn()
const alunoSingleMock = vi.fn()
const insertMock = vi.fn()

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock("@/lib/ra/generate", () => ({ gerarRA: gerarRAMock }))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (tabela: string) => {
      if (tabela === "matriculas") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: matriculaMaybeSingleMock }) }) }),
          insert: insertMock,
        }
      }
      return {
        select: () => ({ eq: () => ({ single: alunoSingleMock }) }),
      }
    },
  },
}))

describe("confirmarMatricula", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    gerarRAMock.mockReset()
    matriculaMaybeSingleMock.mockReset()
    alunoSingleMock.mockReset()
    insertMock.mockReset()
  })

  it("recusa quando não há usuário autenticado como aluno", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null)

    const { confirmarMatricula } = await import("@/app/aluno/matricula/actions")
    const resultado = await confirmarMatricula()

    expect(resultado).toEqual({ ok: false, erro: "Não autenticado como aluno." })
  })

  it("recusa quando a matrícula do ano já existe", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    matriculaMaybeSingleMock.mockResolvedValueOnce({ data: { id: "matricula-1" } })

    const { confirmarMatricula } = await import("@/app/aluno/matricula/actions")
    const resultado = await confirmarMatricula()

    expect(resultado.ok).toBe(false)
    expect(gerarRAMock).not.toHaveBeenCalled()
  })

  it("gera RA quando o aluno ainda não tem um e confirma a matrícula", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    matriculaMaybeSingleMock.mockResolvedValueOnce({ data: null })
    alunoSingleMock.mockResolvedValueOnce({ data: { ra: null, nome: "Fulano" } })
    gerarRAMock.mockResolvedValueOnce({ ra: "RA-2026-0001", driveFolderId: "drive-1" })
    insertMock.mockResolvedValueOnce({ error: null })

    const { confirmarMatricula } = await import("@/app/aluno/matricula/actions")
    const resultado = await confirmarMatricula()

    expect(gerarRAMock).toHaveBeenCalledWith("aluno-1", "Fulano")
    expect(resultado).toEqual({ ok: true, ra: "RA-2026-0001" })
  })

  it("não gera RA de novo quando o aluno já tem um", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    matriculaMaybeSingleMock.mockResolvedValueOnce({ data: null })
    alunoSingleMock.mockResolvedValueOnce({ data: { ra: "RA-2025-0042", nome: "Fulano" } })
    insertMock.mockResolvedValueOnce({ error: null })

    const { confirmarMatricula } = await import("@/app/aluno/matricula/actions")
    const resultado = await confirmarMatricula()

    expect(gerarRAMock).not.toHaveBeenCalled()
    expect(resultado).toEqual({ ok: true, ra: "RA-2025-0042" })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/app/aluno/matricula/actions.test.ts`
Expected: FAIL com "Cannot find module '@/app/aluno/matricula/actions'".

- [ ] **Step 3: Implementar**

```ts
// app/aluno/matricula/actions.ts
"use server"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { gerarRA } from "@/lib/ra/generate"
import { getCurrentUser } from "@/lib/auth/current-user"

export type ConfirmarMatriculaResult = { ok: true; ra: string } | { ok: false; erro: string }

export async function confirmarMatricula(): Promise<ConfirmarMatriculaResult> {
  const usuario = await getCurrentUser()
  if (!usuario || usuario.papel !== "aluno") {
    return { ok: false, erro: "Não autenticado como aluno." }
  }

  const ano = new Date().getFullYear()

  const { data: existente } = await supabaseAdmin
    .from("matriculas")
    .select("id")
    .eq("aluno_id", usuario.usuarioId)
    .eq("ano", ano)
    .maybeSingle()

  if (existente) {
    return { ok: false, erro: `Matrícula de ${ano} já confirmada.` }
  }

  const { data: aluno } = await supabaseAdmin
    .from("alunos")
    .select("ra, nome")
    .eq("usuario_id", usuario.usuarioId)
    .single()

  if (!aluno) {
    return { ok: false, erro: "Cadastro de aluno não encontrado." }
  }

  let ra = aluno.ra as string | null
  if (!ra) {
    const resultado = await gerarRA(usuario.usuarioId, aluno.nome as string)
    ra = resultado.ra
  }

  const { error: insertError } = await supabaseAdmin
    .from("matriculas")
    .insert({ aluno_id: usuario.usuarioId, ano })

  if (insertError) {
    return { ok: false, erro: `Falha ao registrar matrícula: ${insertError.message}` }
  }

  return { ok: true, ra }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/app/aluno/matricula/actions.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Criar a tela de Matrícula**

```tsx
// app/aluno/matricula/page.tsx
"use client"

import { useState } from "react"
import { confirmarMatricula } from "./actions"

export default function MatriculaPage() {
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function handleConfirmar() {
    const resultado = await confirmarMatricula()
    setMensagem(resultado.ok ? `Matrícula confirmada. Seu RA: ${resultado.ra}` : resultado.erro)
  }

  return (
    <div>
      <h1>Matrícula Anual</h1>
      <button onClick={handleConfirmar}>Confirmar matrícula</button>
      {mensagem && <p>{mensagem}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/aluno/matricula tests/app/aluno/matricula/actions.test.ts
git commit -m "feat: add annual enrollment flow with RA generation on first confirmation"
```

---

### Task 9: Verificação manual (smoke test dos três fluxos)

**Files:** nenhum arquivo novo — apenas execução manual.

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes (workspace, aluno-session, current-user, gerarRA, confirmarMatricula) passam.

- [ ] **Step 2: Subir o servidor de desenvolvimento**

Run: `npm run dev`
Expected: servidor sobe em `http://localhost:3000` sem erro no console.

- [ ] **Step 3: Testar login do staff**

No navegador, acesse `http://localhost:3000/staff/login`, clique em "Entrar com conta do Google Workspace" e faça login com uma conta `@stnbnec.com` de teste.
Expected: login concluído, sem erro; tentar com uma conta fora do domínio deve ser recusado pelo callback `signIn`.

- [ ] **Step 4: Testar login e matrícula do aluno**

Insira manualmente um registro de teste nas tabelas `usuarios` (tipo `aluno`, com um `external_id` igual ao UID de um usuário criado no Firebase Authentication) e `alunos` (mesmo `usuario_id`, `nome` preenchido, `ra` nulo) via SQL Editor do Supabase. Acesse `http://localhost:3000/aluno/login`, entre com esse usuário de teste, e em seguida acesse `/aluno/matricula` e clique em "Confirmar matrícula".
Expected: mensagem exibe o RA gerado (formato `RA-{ano}-0001`); no Supabase, a linha do aluno tem `ra` e `drive_folder_id` preenchidos; no Google Drive, a pasta `RA-{ano}-0001 - {Nome}` foi criada dentro da pasta raiz configurada; uma nova linha aparece em `matriculas`. Clicar em "Confirmar matrícula" de novo deve mostrar o erro de matrícula já confirmada, sem gerar um RA novo.

- [ ] **Step 4 (nota):** Este é o único passo de verificação manual no navegador do plano — cobre os três fluxos desta fase de ponta a ponta antes de avançar para a Fase 2 (Acadêmico).
