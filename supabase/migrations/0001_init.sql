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
