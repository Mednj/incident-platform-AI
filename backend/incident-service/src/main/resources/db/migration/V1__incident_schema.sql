create extension if not exists pgcrypto;

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    display_name text not null,
    role text not null,
    created_at timestamptz not null default now()
);

create table if not exists teams (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists services (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    owner_team text,
    environment text not null default 'prod',
    created_at timestamptz not null default now()
);

create table if not exists log_entries (
    id uuid primary key default gen_random_uuid(),
    external_log_id text,
    service text not null,
    environment text not null,
    severity text not null,
    message text not null,
    trace_id text,
    fingerprint text,
    occurred_at timestamptz not null,
    created_at timestamptz not null default now()
);

create table if not exists incidents (
    id uuid primary key,
    title text not null,
    severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status text not null check (status in ('OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED')),
    affected_service text not null,
    environment text not null,
    fingerprint text not null,
    first_seen_at timestamptz not null,
    last_seen_at timestamptz not null,
    event_count bigint not null default 1,
    assignee text,
    triggering_summary text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_incidents_fingerprint_status on incidents(fingerprint, status);
create index if not exists idx_incidents_last_seen on incidents(last_seen_at desc);

create table if not exists incident_events (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid not null references incidents(id) on delete cascade,
    event_type text not null,
    body text not null,
    created_at timestamptz not null default now()
);

create table if not exists incident_comments (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid not null references incidents(id) on delete cascade,
    author_email text not null,
    body text not null,
    created_at timestamptz not null default now()
);

create table if not exists incident_assignments (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid not null references incidents(id) on delete cascade,
    assignee_email text not null,
    created_at timestamptz not null default now()
);

create table if not exists ai_analysis (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid not null references incidents(id) on delete cascade,
    summary text not null,
    likely_causes text[] not null,
    recommended_next_steps text[] not null,
    confidence numeric(3,2) not null,
    model_provider text not null,
    model_name text not null,
    created_at timestamptz not null default now()
);

create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid,
    channel text not null,
    status text not null,
    body text not null,
    created_at timestamptz not null default now()
);
