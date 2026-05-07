insert into users(email, display_name, role) values
('dev@example.com', 'Demo Developer', 'DEVELOPER'),
('admin@example.com', 'Platform Admin', 'ADMIN')
on conflict (email) do nothing;

insert into teams(name) values ('Platform'), ('Payments'), ('Core API')
on conflict (name) do nothing;

insert into services(name, owner_team, environment) values
('checkout-api', 'Payments', 'prod'),
('billing-worker', 'Payments', 'prod'),
('identity-api', 'Core API', 'prod')
on conflict (name) do nothing;

insert into incidents(id, title, severity, status, affected_service, environment, fingerprint,
first_seen_at, last_seen_at, event_count, assignee, triggering_summary)
values (
    '11111111-1111-1111-1111-111111111111',
    'checkout-api ERROR: PaymentProviderTimeoutException while authorizing payment',
    'HIGH',
    'OPEN',
    'checkout-api',
    'prod',
    'demo-payment-timeout',
    now() - interval '42 minutes',
    now() - interval '3 minutes',
    18,
    'dev@example.com',
    'Payment provider calls are timing out during checkout authorization.'
)
on conflict (id) do nothing;

insert into incident_events(incident_id, event_type, body)
values ('11111111-1111-1111-1111-111111111111', 'CREATED', 'Demo incident seeded for portfolio walkthrough');

