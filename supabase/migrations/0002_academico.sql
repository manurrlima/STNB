create table configuracao_academica (
  id integer primary key default 1,
  media_minima numeric(4,2) not null default 7.0,
  janela_inscricao_dias integer not null default 20,
  constraint configuracao_academica_singleton check (id = 1)
);

insert into configuracao_academica (id) values (1);

create table disciplinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor_mensal numeric(10,2) not null,
  pre_requisito_id uuid references disciplinas(id),
  criado_em timestamptz not null default now()
);

create table ofertas (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references disciplinas(id),
  ano integer not null,
  trimestre text not null,
  data_inicio_aulas date not null,
  horario_aula time not null,
  fechado boolean not null default false,
  criado_em timestamptz not null default now()
);

create type status_progresso as enum ('cursando', 'aprovado', 'reprovado', 'pendente');

create table progresso_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(usuario_id) on delete cascade,
  disciplina_id uuid not null references disciplinas(id),
  status status_progresso not null default 'pendente',
  n1 numeric(4,2),
  n2 numeric(4,2),
  atualizado_em timestamptz not null default now(),
  unique (aluno_id, disciplina_id)
);

create table inscricoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(usuario_id) on delete cascade,
  ano integer not null,
  trimestre text not null,
  valor_mensalidade numeric(10,2) not null,
  confirmada_em timestamptz not null default now(),
  unique (aluno_id, ano, trimestre)
);

create table inscricao_ofertas (
  inscricao_id uuid not null references inscricoes(id) on delete cascade,
  oferta_id uuid not null references ofertas(id),
  primary key (inscricao_id, oferta_id)
);

alter table configuracao_academica enable row level security;
alter table disciplinas enable row level security;
alter table ofertas enable row level security;
alter table progresso_aluno enable row level security;
alter table inscricoes enable row level security;
alter table inscricao_ofertas enable row level security;
