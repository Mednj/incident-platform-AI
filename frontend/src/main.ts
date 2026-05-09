import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Component, computed, Injectable, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './shared/auth.interceptor';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type LogSeverity = Severity | 'ERROR' | 'WARN';
type Status = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';
type WorkspaceTab = 'overview' | 'demo' | 'incidents' | 'postmortem' | 'slo' | 'notifications' | 'pipeline' | 'schemas' | 'logs' | 'admin';

interface LoginResponse {
  token: string;
  email: string;
  displayName: string;
  roles: string[];
}

interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: Status;
  affectedService: string;
  environment: string;
  fingerprint: string;
  firstSeenAt: string;
  lastSeenAt: string;
  eventCount: number;
  assignee: string | null;
  triggeringSummary: string;
}

interface TimelineEvent {
  type: string;
  body: string;
  createdAt: string;
}

interface IncidentDetail {
  incident: Incident;
  timeline: TimelineEvent[];
}

interface Analysis {
  id: string;
  incidentId: string;
  summary: string;
  likelyCauses: string[];
  recommendedNextSteps: string[];
  confidence: number;
  modelProvider: string;
  modelName: string;
  createdAt: string;
}

interface PipelineStage {
  name: string;
  service: string;
  topic: string;
  event: string;
  state: 'healthy' | 'active' | 'warning';
  messages: number;
  latency: string;
}

interface SchemaContract {
  event: string;
  topic: string;
  subject: string;
  producer: string;
  consumers: string[];
  compatibility: string;
  fields: string[];
}

interface DemoLog {
  timestamp: string;
  service: string;
  severity: LogSeverity;
  traceId: string;
  fingerprint: string;
  message: string;
}

interface ArchitectureStep {
  label: string;
  service: string;
  topic: string;
  description: string;
}

interface SloProfile {
  service: string;
  objective: string;
  availability: number;
  errorBudgetUsed: number;
  burnRate: string;
  threshold: string;
  rationale: string;
}

interface NotificationChannel {
  name: string;
  target: string;
  mode: string;
  enabled: boolean;
  lastPayload: string;
}

const demoIncidents: Incident[] = [
  {
    id: 'demo-payment-timeout',
    title: 'checkout-api ERROR: PaymentProviderTimeoutException while authorizing payment',
    severity: 'HIGH',
    status: 'OPEN',
    affectedService: 'checkout-api',
    environment: 'prod',
    fingerprint: 'demo-payment-timeout',
    firstSeenAt: new Date(Date.now() - 1000 * 60 * 44).toISOString(),
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    eventCount: 18,
    assignee: 'dev@example.com',
    triggeringSummary: 'Payment provider calls are timing out during checkout authorization.'
  },
  {
    id: 'demo-token-refresh',
    title: 'identity-api WARN: token refresh latency above threshold',
    severity: 'MEDIUM',
    status: 'INVESTIGATING',
    affectedService: 'identity-api',
    environment: 'prod',
    fingerprint: 'demo-token-refresh',
    firstSeenAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    eventCount: 9,
    assignee: null,
    triggeringSummary: 'Authentication token refresh calls are slower than the configured SLO.'
  },
  {
    id: 'demo-billing-retry',
    title: 'billing-worker CRITICAL: retry queue depth is growing',
    severity: 'CRITICAL',
    status: 'OPEN',
    affectedService: 'billing-worker',
    environment: 'prod',
    fingerprint: 'demo-billing-retry',
    firstSeenAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    lastSeenAt: new Date(Date.now() - 1000 * 60).toISOString(),
    eventCount: 43,
    assignee: 'platform@example.com',
    triggeringSummary: 'Billing retry topic depth is increasing after downstream processor failures.'
  }
];

const demoLogs: DemoLog[] = [
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    service: 'checkout-api',
    severity: 'ERROR',
    traceId: 'trace-48291',
    fingerprint: 'demo-payment-timeout',
    message: 'PaymentProviderTimeoutException order 48291 failed while authorizing payment'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    service: 'identity-api',
    severity: 'WARN',
    traceId: 'trace-auth-771',
    fingerprint: 'demo-token-refresh',
    message: 'Token refresh p95 latency above threshold for oauth-client'
  } as DemoLog,
  {
    timestamp: new Date(Date.now() - 1000 * 60).toISOString(),
    service: 'billing-worker',
    severity: 'CRITICAL',
    traceId: 'trace-bill-88',
    fingerprint: 'demo-billing-retry',
    message: 'Retry queue depth crossed 10k messages after processor timeout'
  }
];

const pipelineStages: PipelineStage[] = [
  { name: 'Ingest', service: 'ingestion-service', topic: 'logs.received.v1', event: 'LogReceivedEvent', state: 'active', messages: 1284, latency: '18 ms' },
  { name: 'Normalize', service: 'event-processor-service', topic: 'logs.normalized.v1', event: 'LogNormalizedEvent', state: 'healthy', messages: 1269, latency: '42 ms' },
  { name: 'Group', service: 'event-processor-service', topic: 'incidents.candidates.v1', event: 'IncidentCandidateEvent', state: 'active', messages: 74, latency: '55 ms' },
  { name: 'Persist', service: 'incident-service', topic: 'incidents.created.v1', event: 'IncidentCreatedEvent', state: 'healthy', messages: 22, latency: '31 ms' },
  { name: 'Explain', service: 'ai-analysis-service', topic: 'ai.analysis.completed.v1', event: 'AIAnalysisCompletedEvent', state: 'warning', messages: 16, latency: '780 ms' }
];

const schemaContracts: SchemaContract[] = [
  {
    event: 'LogReceivedEvent',
    topic: 'logs.received.v1',
    subject: 'logs.received.v1-value',
    producer: 'ingestion-service',
    consumers: ['event-processor-service'],
    compatibility: 'BACKWARD',
    fields: ['logId', 'application', 'environment', 'severity', 'occurredAt', 'traceId', 'message', 'attributes']
  },
  {
    event: 'LogNormalizedEvent',
    topic: 'logs.normalized.v1',
    subject: 'logs.normalized.v1-value',
    producer: 'event-processor-service',
    consumers: ['incident-service', 'log-search'],
    compatibility: 'BACKWARD',
    fields: ['service', 'fingerprint', 'errorClass', 'stackTraceHash', 'structuredFields']
  },
  {
    event: 'IncidentCandidateEvent',
    topic: 'incidents.candidates.v1',
    subject: 'incidents.candidates.v1-value',
    producer: 'event-processor-service',
    consumers: ['incident-service'],
    compatibility: 'BACKWARD',
    fields: ['fingerprint', 'affectedService', 'severity', 'firstSeenAt', 'lastSeenAt', 'eventCount']
  },
  {
    event: 'AIAnalysisCompletedEvent',
    topic: 'ai.analysis.completed.v1',
    subject: 'ai.analysis.completed.v1-value',
    producer: 'ai-analysis-service',
    consumers: ['incident-service', 'notification-service'],
    compatibility: 'BACKWARD',
    fields: ['incidentId', 'summary', 'likelyCauses', 'recommendedNextSteps', 'confidence', 'modelMetadata']
  }
];

const architectureSteps: ArchitectureStep[] = [
  {
    label: 'Send log',
    service: 'ingestion-service',
    topic: 'logs.received.v1',
    description: 'REST input is validated, converted to Avro, and published as a durable event.'
  },
  {
    label: 'Kafka',
    service: 'Kafka broker',
    topic: 'logs.received.v1',
    description: 'The event backbone decouples producers from downstream processing services.'
  },
  {
    label: 'Normalize',
    service: 'event-processor-service',
    topic: 'logs.normalized.v1',
    description: 'Raw messages are parsed into structured severity, service, trace, error class, and fingerprint fields.'
  },
  {
    label: 'Incident',
    service: 'incident-service',
    topic: 'incidents.candidates.v1',
    description: 'Matching fingerprints update open incidents; new fingerprints create separate incidents.'
  },
  {
    label: 'AI analysis',
    service: 'ai-analysis-service',
    topic: 'ai.analysis.completed.v1',
    description: 'The incident context is summarized into likely causes, next steps, and confidence metadata.'
  }
];

const sloProfiles: SloProfile[] = [
  {
    service: 'checkout-api',
    objective: '99.95%',
    availability: 99.91,
    errorBudgetUsed: 72,
    burnRate: '4.8x',
    threshold: 'Page when payment authorization errors exceed 2% for 10 minutes',
    rationale: 'HIGH severity because payment authorization is user-facing and grouped failures are still active.'
  },
  {
    service: 'billing-worker',
    objective: '99.90%',
    availability: 99.84,
    errorBudgetUsed: 89,
    burnRate: '8.1x',
    threshold: 'Escalate when retry queue depth stays above 10k for 5 minutes',
    rationale: 'CRITICAL severity because delayed billing retries can create reconciliation and revenue risk.'
  },
  {
    service: 'identity-api',
    objective: '99.99%',
    availability: 99.985,
    errorBudgetUsed: 31,
    burnRate: '1.4x',
    threshold: 'Warn when token refresh p95 latency exceeds 850 ms',
    rationale: 'MEDIUM severity because degraded identity latency is visible but not fully blocking.'
  }
];

const notificationChannels: NotificationChannel[] = [
  {
    name: 'Slack incident channel',
    target: '#prod-incidents',
    mode: 'Mock webhook',
    enabled: true,
    lastPayload: 'HIGH checkout-api incident created with 18 grouped events'
  },
  {
    name: 'Email escalation',
    target: 'platform-oncall@example.com',
    mode: 'Planned extension',
    enabled: false,
    lastPayload: 'Escalation email queued after status moves to INVESTIGATING'
  },
  {
    name: 'PagerDuty bridge',
    target: 'payments-critical',
    mode: 'Planned extension',
    enabled: false,
    lastPayload: 'CRITICAL incidents can be routed to on-call policy'
  }
];

@Injectable({ providedIn: 'root' })
class SessionService {
  user = signal<LoginResponse | null>(this.readUser());
  offline = signal(localStorage.getItem('incident-platform-offline-demo') === 'true');

  constructor(private readonly http: HttpClient) {}

  async login(email: string, password: string) {
    const response = await firstValueFrom(this.http.post<LoginResponse>('http://localhost:8086/api/auth/login', { email, password }));
    localStorage.setItem('incident-platform-session', JSON.stringify(response));
    localStorage.removeItem('incident-platform-offline-demo');
    this.offline.set(false);
    this.user.set(response);
  }

  startOfflineDemo() {
    const response = {
      token: 'offline-demo-token',
      email: 'dev@example.com',
      displayName: 'Demo Developer',
      roles: ['DEVELOPER']
    };
    localStorage.setItem('incident-platform-session', JSON.stringify(response));
    localStorage.setItem('incident-platform-offline-demo', 'true');
    this.offline.set(true);
    this.user.set(response);
  }

  logout() {
    localStorage.removeItem('incident-platform-session');
    localStorage.removeItem('incident-platform-offline-demo');
    this.offline.set(false);
    this.user.set(null);
  }

  private readUser(): LoginResponse | null {
    const raw = localStorage.getItem('incident-platform-session');
    return raw ? JSON.parse(raw) as LoginResponse : null;
  }
}

@Injectable({ providedIn: 'root' })
class IncidentApi {
  constructor(private readonly http: HttpClient) {}

  async list(filters: { status: string; severity: string; service: string }, offline: boolean) {
    if (offline) return this.filteredDemoIncidents(filters);
    return firstValueFrom(this.http.get<Incident[]>(`http://localhost:8083/api/incidents?${this.params(filters)}`));
  }

  async detail(id: string, offline: boolean) {
    if (offline) return this.demoDetail(id);
    return firstValueFrom(this.http.get<IncidentDetail>(`http://localhost:8083/api/incidents/${id}`));
  }

  async updateStatus(id: string, status: Status, offline: boolean) {
    if (offline) {
      const incident = demoIncidents.find(item => item.id === id);
      if (incident) incident.status = status;
      return incident;
    }
    return firstValueFrom(this.http.patch<Incident>(`http://localhost:8083/api/incidents/${id}/status`, { status }));
  }

  requestAnalysis(id: string, offline: boolean) {
    if (offline) return Promise.resolve({ accepted: true });
    return firstValueFrom(this.http.post(`http://localhost:8083/api/incidents/${id}/ai-analysis`, {}));
  }

  async latestAnalysis(id: string, offline: boolean) {
    if (offline) return this.demoAnalysis(id);
    return firstValueFrom(this.http.get<Analysis | null>(`http://localhost:8084/api/ai/incidents/${id}/latest`));
  }

  async ingestDemoLog(offline: boolean) {
    const log = {
      application: 'checkout-api',
      environment: 'prod',
      severity: 'ERROR',
      occurredAt: new Date().toISOString(),
      traceId: crypto.randomUUID(),
      host: 'checkout-pod-7',
      message: 'PaymentProviderTimeoutException order 48291 failed while authorizing payment',
      attributes: { region: 'us-east-1', endpoint: '/checkout' }
    };
    if (offline) {
      demoIncidents[0].eventCount += 1;
      demoIncidents[0].lastSeenAt = new Date().toISOString();
      demoLogs.unshift({
        timestamp: log.occurredAt,
        service: log.application,
        severity: 'ERROR',
        traceId: log.traceId,
        fingerprint: demoIncidents[0].fingerprint,
        message: log.message
      });
      return { logId: crypto.randomUUID(), status: 'accepted' };
    }
    return firstValueFrom(this.http.post('http://localhost:8081/api/logs', log));
  }

  private params(filters: { status: string; severity: string; service: string }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }

  private filteredDemoIncidents(filters: { status: string; severity: string; service: string }) {
    return demoIncidents.filter(incident =>
      (!filters.status || incident.status === filters.status) &&
      (!filters.severity || incident.severity === filters.severity) &&
      (!filters.service || incident.affectedService.includes(filters.service))
    );
  }

  private demoDetail(id: string): IncidentDetail {
    const incident = demoIncidents.find(item => item.id === id) ?? demoIncidents[0];
    return {
      incident,
      timeline: [
        { type: 'UPDATED', body: 'Matching event grouped into incident', createdAt: incident.lastSeenAt },
        { type: 'AI_ANALYSIS', body: 'Local analysis generated likely causes and next steps', createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
        { type: 'CREATED', body: 'Incident created from Kafka candidate', createdAt: incident.firstSeenAt }
      ]
    };
  }

  private demoAnalysis(id: string): Analysis {
    const incident = demoIncidents.find(item => item.id === id) ?? demoIncidents[0];
    return {
      id: `analysis-${incident.id}`,
      incidentId: incident.id,
      summary: `${incident.affectedService} is producing repeated ${incident.severity.toLowerCase()} events in ${incident.environment}. The current fingerprint groups ${incident.eventCount} related logs into one incident.`,
      likelyCauses: [
        'Repeated failures share the same deterministic fingerprint',
        'The triggering log points to a service-level failure path',
        'Recent event volume suggests the issue is active rather than historical'
      ],
      recommendedNextSteps: [
        `Inspect recent deploys for ${incident.affectedService}`,
        'Check traces and upstream dependency health around the first seen time',
        'Move the incident to INVESTIGATING and attach owner findings'
      ],
      confidence: 0.74,
      modelProvider: 'local',
      modelName: 'local-investigation-summary-v1',
      createdAt: new Date().toISOString()
    };
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (!session.user()) {
      <main class="login-shell">
        <section class="login-panel">
          <p class="eyebrow">AI Incident Platform</p>
          <h1>Production investigation command center</h1>
          <p class="login-copy">Explore a Kafka, Avro, Schema Registry, PostgreSQL, and Angular incident workflow built for production-style debugging.</p>
          <form (ngSubmit)="login()" class="login-form">
            <label>Email <input name="email" [(ngModel)]="email"></label>
            <label>Password <input name="password" type="password" [(ngModel)]="password"></label>
            <button type="submit">Sign in with backend</button>
          </form>
          <button class="secondary full" type="button" (click)="startOfflineDemo()">Open recruiter demo without Docker</button>
          <p class="hint">{{ loginMessage() || 'Demo backend: dev@example.com / password' }}</p>
        </section>
      </main>
    } @else {
      <main class="workspace">
        <aside class="sidebar">
          <div>
            <p class="eyebrow">Incident Platform AI</p>
            <h1>Investigation</h1>
            @if (session.offline()) { <span class="mode-badge">Offline demo</span> }
          </div>
          <nav>
            <button [class.active]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
            <button [class.active]="tab() === 'demo'" (click)="tab.set('demo')">Guided Demo</button>
            <button [class.active]="tab() === 'incidents'" (click)="tab.set('incidents')">Incidents</button>
            <button [class.active]="tab() === 'postmortem'" (click)="tab.set('postmortem')">Postmortem</button>
            <button [class.active]="tab() === 'slo'" (click)="tab.set('slo')">SLO Budget</button>
            <button [class.active]="tab() === 'notifications'" (click)="tab.set('notifications')">Notifications</button>
            <button [class.active]="tab() === 'pipeline'" (click)="tab.set('pipeline')">Event Pipeline</button>
            <button [class.active]="tab() === 'schemas'" (click)="tab.set('schemas')">Avro Contracts</button>
            <button [class.active]="tab() === 'logs'" (click)="tab.set('logs')">Log Search</button>
            <button [class.active]="tab() === 'admin'" (click)="tab.set('admin')">Services</button>
          </nav>
          <button class="ghost" (click)="session.logout()">Sign out</button>
        </aside>

        <section class="content">
          @if (tab() === 'overview') {
            <header class="toolbar hero-toolbar">
              <div>
                <p class="eyebrow">Operational overview</p>
                <h2>AI-ready incident command center</h2>
                <p>One screen to understand incident volume, event movement, contract health, and investigation readiness.</p>
              </div>
              <button (click)="ingestDemo()">Replay demo failure</button>
            </header>

            <section class="kpi-grid">
              <article><span>{{ incidents().length }}</span><p>Grouped incidents</p></article>
              <article><span>{{ totalEvents() }}</span><p>Related log events</p></article>
              <article><span>{{ criticalCount() }}</span><p>Critical incidents</p></article>
              <article><span>{{ schemaContracts.length }}</span><p>Avro contracts</p></article>
            </section>

            <section class="overview-grid">
              <article class="insight-card">
                <h3>Highest risk service</h3>
                <strong>{{ topService() }}</strong>
                <p>Ranked by open incident severity and grouped event count.</p>
              </article>
              <article class="insight-card">
                <h3>Pipeline health</h3>
                <div class="mini-pipeline">
                  @for (stage of pipelineStages; track stage.name) {
                    <span [class]="stage.state">{{ stage.name }}</span>
                  }
                </div>
              </article>
              <article class="insight-card">
                <h3>Investigation playbook</h3>
                <ol>
                  <li>Validate latest log fingerprint.</li>
                  <li>Check Kafka topics and Avro contract subject.</li>
                  <li>Refresh analysis, inspect SLO burn, and notify owners.</li>
                </ol>
              </article>
            </section>
          }

          @if (tab() === 'demo') {
            <header class="toolbar">
              <div>
                <h2>Guided architecture demo</h2>
                <p>Replay the path from raw log to Kafka event, normalized fingerprint, incident, and AI-ready analysis.</p>
              </div>
              <button (click)="runArchitectureDemo()">Run guided flow</button>
            </header>

            <section class="architecture-demo">
              @for (step of architectureSteps; track step.label; let index = $index) {
                <article [class.active]="index <= activeArchitectureStep()" [class.current]="index === activeArchitectureStep()">
                  <span>{{ index + 1 }}</span>
                  <h3>{{ step.label }}</h3>
                  <p>{{ step.description }}</p>
                  <code>{{ step.service }} / {{ step.topic }}</code>
                </article>
              }
            </section>

            <section class="demo-console">
              <div>
                <p class="eyebrow">Current event</p>
                <h3>{{ architectureSteps[activeArchitectureStep()].label }}</h3>
                <p>{{ architectureSteps[activeArchitectureStep()].description }}</p>
              </div>
              <pre>{{ architecturePayload() }}</pre>
            </section>
          }

          @if (tab() === 'incidents') {
            <header class="toolbar">
              <div>
                <h2>Incident dashboard</h2>
                <p>{{ openCount() }} active incidents across production services</p>
              </div>
              <button (click)="ingestDemo()">Send demo error log</button>
            </header>

            <section class="filters">
              <label>Status
                <select [(ngModel)]="filters.status" (change)="loadIncidents()">
                  <option value="">All</option>
                  <option>OPEN</option>
                  <option>INVESTIGATING</option>
                  <option>MITIGATED</option>
                  <option>RESOLVED</option>
                  <option>CLOSED</option>
                </select>
              </label>
              <label>Severity
                <select [(ngModel)]="filters.severity" (change)="loadIncidents()">
                  <option value="">All</option>
                  <option>LOW</option>
                  <option>MEDIUM</option>
                  <option>HIGH</option>
                  <option>CRITICAL</option>
                </select>
              </label>
              <label>Service
                <input [(ngModel)]="filters.service" (keyup.enter)="loadIncidents()" placeholder="checkout-api">
              </label>
              <button class="secondary" (click)="loadIncidents()">Apply</button>
            </section>

            <div class="incident-layout">
              <section class="incident-list">
                @for (incident of incidents(); track incident.id) {
                  <article class="incident-row" [class.selected]="selected()?.incident?.id === incident.id" (click)="select(incident.id)">
                    <div class="row-head">
                      <span class="badge" [class.low]="incident.severity === 'LOW'" [class.medium]="incident.severity === 'MEDIUM'" [class.high]="incident.severity === 'HIGH'" [class.critical]="incident.severity === 'CRITICAL'">{{ incident.severity }}</span>
                      <span>{{ incident.status }}</span>
                    </div>
                    <h3>{{ incident.title }}</h3>
                    <p>{{ incident.affectedService }} / {{ incident.environment }} / {{ incident.eventCount }} events</p>
                    <div class="risk-meter"><span [style.width.%]="riskScore(incident)"></span></div>
                  </article>
                }
              </section>

              @if (selected(); as detail) {
                <section class="detail">
                  <div class="detail-head">
                    <div>
                      <span class="badge" [class.low]="detail.incident.severity === 'LOW'" [class.medium]="detail.incident.severity === 'MEDIUM'" [class.high]="detail.incident.severity === 'HIGH'" [class.critical]="detail.incident.severity === 'CRITICAL'">{{ detail.incident.severity }}</span>
                      <h2>{{ detail.incident.title }}</h2>
                      <p>{{ detail.incident.triggeringSummary }}</p>
                    </div>
                    <select [ngModel]="detail.incident.status" (ngModelChange)="setStatus($event)">
                      <option>OPEN</option>
                      <option>INVESTIGATING</option>
                      <option>MITIGATED</option>
                      <option>RESOLVED</option>
                      <option>CLOSED</option>
                    </select>
                  </div>

                  <div class="meta-grid">
                    <span>Service <strong>{{ detail.incident.affectedService }}</strong></span>
                    <span>Environment <strong>{{ detail.incident.environment }}</strong></span>
                    <span>Assignee <strong>{{ detail.incident.assignee || 'Unassigned' }}</strong></span>
                    <span>Fingerprint <strong>{{ detail.incident.fingerprint }}</strong></span>
                  </div>

                  <section class="ai-panel">
                    <div class="panel-title">
                      <h3>AI-ready analysis</h3>
                      <button (click)="requestAnalysis(detail.incident.id)">Refresh analysis</button>
                    </div>
                    @if (analysis(); as ai) {
                      <p>{{ ai.summary }}</p>
                      <div class="two-col">
                        <div>
                          <h4>Likely causes</h4>
                          @for (cause of ai.likelyCauses; track cause) { <p class="pill">{{ cause }}</p> }
                        </div>
                        <div>
                          <h4>Next steps</h4>
                          @for (step of ai.recommendedNextSteps; track step) { <p class="pill">{{ step }}</p> }
                        </div>
                      </div>
                      <p class="hint">{{ ai.modelProvider }} / {{ ai.modelName }} / confidence {{ ai.confidence }}</p>
                    } @else {
                      <p>No analysis yet. Trigger one to generate a summary and next actions.</p>
                    }
                  </section>

                  <section>
                    <h3>Timeline</h3>
                    @for (event of detail.timeline; track event.createdAt + event.body) {
                      <div class="timeline-item">
                        <strong>{{ event.type }}</strong>
                        <p>{{ event.body }}</p>
                      </div>
                    }
                  </section>
                </section>
              }
            </div>
          }

          @if (tab() === 'pipeline') {
            <header class="toolbar">
              <div>
                <h2>Kafka event pipeline</h2>
                <p>Visualizes how a log becomes a normalized event, incident candidate, stored incident, and analysis result.</p>
              </div>
              <button (click)="ingestDemo()">Replay log through pipeline</button>
            </header>
            <section class="pipeline-board">
              @for (stage of pipelineStages; track stage.name) {
                <article class="pipeline-stage" [class]="stage.state">
                  <span>{{ stage.name }}</span>
                  <h3>{{ stage.service }}</h3>
                  <p>{{ stage.event }}</p>
                  <code>{{ stage.topic }}</code>
                  <div class="stage-stats">
                    <strong>{{ stage.messages }}</strong>
                    <small>{{ stage.latency }}</small>
                  </div>
                </article>
              }
            </section>
          }

          @if (tab() === 'postmortem') {
            <header class="toolbar">
              <div>
                <h2>Postmortem generator</h2>
                <p>Generate a structured incident report from the selected incident, timeline, SLO impact, and analysis.</p>
              </div>
              <button (click)="copyPostmortem()">Copy markdown</button>
            </header>
            <section class="postmortem-layout">
              <article class="postmortem-preview">
                <pre>{{ postmortemMarkdown() }}</pre>
              </article>
              <aside class="postmortem-side">
                <h3>Included sections</h3>
                <p>Summary</p>
                <p>Impact</p>
                <p>Timeline</p>
                <p>Likely causes</p>
                <p>Follow-up actions</p>
                <p>SLO / error budget context</p>
              </aside>
            </section>
          }

          @if (tab() === 'slo') {
            <header class="toolbar">
              <div>
                <h2>SLO and error budget</h2>
                <p>Explain severity decisions with service objectives, burn rate, alert thresholds, and user impact.</p>
              </div>
            </header>
            <section class="slo-grid">
              @for (slo of sloProfiles; track slo.service) {
                <article class="slo-card">
                  <div class="slo-head">
                    <div>
                      <p class="eyebrow">{{ slo.service }}</p>
                      <h3>{{ slo.objective }} SLO</h3>
                    </div>
                    <strong>{{ slo.burnRate }}</strong>
                  </div>
                  <div class="budget-bar"><span [style.width.%]="slo.errorBudgetUsed"></span></div>
                  <p><b>{{ slo.errorBudgetUsed }}%</b> of monthly error budget consumed. Current availability: <b>{{ slo.availability }}%</b>.</p>
                  <p><b>Alert threshold:</b> {{ slo.threshold }}</p>
                  <p><b>Severity rationale:</b> {{ slo.rationale }}</p>
                </article>
              }
            </section>
          }

          @if (tab() === 'notifications') {
            <header class="toolbar">
              <div>
                <h2>Notification integrations</h2>
                <p>Local mock mode shows how new and escalated incidents would fan out to Slack, email, or paging.</p>
              </div>
              <button (click)="sendMockNotification()">Send Slack mock</button>
            </header>
            <section class="notification-grid">
              @for (channel of notificationChannels; track channel.name) {
                <article class="notification-card" [class.disabled]="!channel.enabled">
                  <div>
                    <p class="eyebrow">{{ channel.mode }}</p>
                    <h3>{{ channel.name }}</h3>
                    <p>{{ channel.target }}</p>
                  </div>
                  <span>{{ channel.enabled ? 'Enabled' : 'Planned' }}</span>
                  <code>{{ channel.lastPayload }}</code>
                </article>
              }
            </section>
            <section class="mock-feed">
              <h3>Mock delivery feed</h3>
              @for (message of notificationFeed(); track message) {
                <p>{{ message }}</p>
              }
            </section>
          }

          @if (tab() === 'schemas') {
            <header class="toolbar">
              <div>
                <h2>Avro contract catalog</h2>
                <p>Schema Registry subjects, producers, consumers, and important fields in one recruiter-friendly view.</p>
              </div>
            </header>
            <section class="contract-grid">
              @for (contract of schemaContracts; track contract.subject) {
                <article class="contract-card">
                  <p class="eyebrow">{{ contract.compatibility }} compatible</p>
                  <h3>{{ contract.event }}</h3>
                  <code>{{ contract.subject }}</code>
                  <p><strong>Producer:</strong> {{ contract.producer }}</p>
                  <p><strong>Consumers:</strong> {{ contract.consumers.join(', ') }}</p>
                  <div class="field-list">
                    @for (field of contract.fields; track field) { <span>{{ field }}</span> }
                  </div>
                </article>
              }
            </section>
          }

          @if (tab() === 'logs') {
            <header class="toolbar">
              <div>
                <h2>Log search and replay</h2>
                <p>Inspect related logs by service, severity, trace ID, and incident fingerprint.</p>
              </div>
              <button (click)="ingestDemo()">Append sample log</button>
            </header>
            <section class="filters">
              <label>Query <input [(ngModel)]="logQuery" placeholder="timeout, trace id, service"></label>
              <label>Severity
                <select [(ngModel)]="logSeverity">
                  <option value="">All</option>
                  <option>LOW</option>
                  <option>MEDIUM</option>
                  <option>HIGH</option>
                  <option>CRITICAL</option>
                  <option>ERROR</option>
                  <option>WARN</option>
                </select>
              </label>
            </section>
            <section class="log-table">
              @for (log of filteredLogs(); track log.timestamp + log.traceId) {
                <article>
                  <span class="badge" [class.high]="log.severity === 'ERROR' || log.severity === 'HIGH'" [class.critical]="log.severity === 'CRITICAL'" [class.medium]="log.severity === 'WARN' || log.severity === 'MEDIUM'">{{ log.severity }}</span>
                  <div>
                    <strong>{{ log.service }}</strong>
                    <p>{{ log.message }}</p>
                    <small>{{ log.traceId }} / {{ log.fingerprint }} / {{ formatTime(log.timestamp) }}</small>
                  </div>
                </article>
              }
            </section>
          }

          @if (tab() === 'admin') {
            <header class="toolbar">
              <div>
                <h2>Service registry</h2>
                <p>Known applications, owners, runtime profile, and current operational posture.</p>
              </div>
            </header>
            <section class="service-grid">
              @for (service of serviceRegistry; track service.name) {
                <article>
                  <span class="status-dot"></span>
                  <h3>{{ service.name }}</h3>
                  <p>Owner: {{ service.owner }}</p>
                  <p>Runtime: {{ service.runtime }}</p>
                  <p>SLO: {{ service.slo }}</p>
                </article>
              }
            </section>
          }
        </section>
      </main>
    }
  `
})
class AppComponent {
  email = 'dev@example.com';
  password = 'password';
  loginMessage = signal('');
  tab = signal<WorkspaceTab>('overview');
  incidents = signal<Incident[]>([]);
  selected = signal<IncidentDetail | null>(null);
  analysis = signal<Analysis | null>(null);
  filters = { status: '', severity: '', service: '' };
  logQuery = '';
  logSeverity = '';
  pipelineStages = pipelineStages;
  schemaContracts = schemaContracts;
  architectureSteps = architectureSteps;
  sloProfiles = sloProfiles;
  notificationChannels = notificationChannels;
  activeArchitectureStep = signal(0);
  notificationFeed = signal([
    '[mock] Slack #prod-incidents received HIGH checkout-api incident notification',
    '[mock] notification-service consumed incidents.created.v1'
  ]);
  serviceRegistry = [
    { name: 'checkout-api', owner: 'Payments Platform', runtime: 'Java 17 / Spring Boot', slo: '99.95%' },
    { name: 'billing-worker', owner: 'Revenue Systems', runtime: 'Java 17 / Kafka consumer', slo: '99.90%' },
    { name: 'identity-api', owner: 'Security Platform', runtime: 'Java 17 / Spring Security', slo: '99.99%' }
  ];
  openCount = computed(() => this.incidents().filter(incident => ['OPEN', 'INVESTIGATING', 'MITIGATED'].includes(incident.status)).length);
  totalEvents = computed(() => this.incidents().reduce((sum, incident) => sum + incident.eventCount, 0));
  criticalCount = computed(() => this.incidents().filter(incident => incident.severity === 'CRITICAL').length);
  topService = computed(() => [...this.incidents()].sort((a, b) => this.riskScore(b) - this.riskScore(a))[0]?.affectedService ?? 'No active incidents');
  architecturePayload = computed(() => {
    const step = this.architectureSteps[this.activeArchitectureStep()];
    const incident = this.selected()?.incident ?? this.incidents()[0] ?? demoIncidents[0];
    return JSON.stringify({
      step: step.label,
      service: step.service,
      topic: step.topic,
      eventKey: incident.fingerprint,
      severity: incident.severity,
      traceId: demoLogs.find(log => log.fingerprint === incident.fingerprint)?.traceId ?? 'trace-demo',
      timestamp: new Date().toISOString()
    }, null, 2);
  });
  postmortemMarkdown = computed(() => {
    const detail = this.selected();
    const incident = detail?.incident ?? this.incidents()[0] ?? demoIncidents[0];
    const analysis = this.analysis();
    const slo = this.sloProfiles.find(profile => profile.service === incident.affectedService) ?? this.sloProfiles[0];
    const causes = analysis?.likelyCauses ?? [
      'Grouped logs share the same deterministic incident fingerprint.',
      'Recent failures point to a service-level dependency or timeout path.'
    ];
    const nextSteps = analysis?.recommendedNextSteps ?? [
      'Inspect recent deploys and configuration changes for the affected service.',
      'Review correlated traces and upstream dependency health around first seen time.',
      'Attach an owner and move the incident to INVESTIGATING.'
    ];
    const timeline = detail?.timeline?.length ? detail.timeline : [
      { type: 'CREATED', body: 'Incident created from candidate event', createdAt: incident.firstSeenAt },
      { type: 'UPDATED', body: 'Matching event grouped into incident', createdAt: incident.lastSeenAt }
    ];

    return [
      `# Postmortem: ${incident.title}`,
      '',
      `**Incident ID:** ${incident.id}`,
      `**Service:** ${incident.affectedService}`,
      `**Environment:** ${incident.environment}`,
      `**Severity:** ${incident.severity}`,
      `**Status:** ${incident.status}`,
      `**Fingerprint:** ${incident.fingerprint}`,
      '',
      '## Summary',
      analysis?.summary ?? incident.triggeringSummary,
      '',
      '## Impact',
      `${incident.eventCount} related events were grouped for ${incident.affectedService}. Current SLO is ${slo.objective}, availability is ${slo.availability}%, and ${slo.errorBudgetUsed}% of the monthly error budget is consumed.`,
      '',
      '## Timeline',
      ...timeline.map(item => `- ${this.formatTime(item.createdAt)} - ${item.type}: ${item.body}`),
      '',
      '## Root Cause Hypotheses',
      ...causes.map(cause => `- ${cause}`),
      '',
      '## Actions Taken',
      '- Incident grouped by Avro-backed Kafka event contracts.',
      '- AI analysis generated a concise investigation summary.',
      '- Notification mock prepared for Slack delivery.',
      '',
      '## Follow-ups',
      ...nextSteps.map(step => `- ${step}`),
      '',
      '## Detection',
      `Alert threshold: ${slo.threshold}`,
      `Severity rationale: ${slo.rationale}`
    ].join('\n');
  });

  constructor(public readonly session: SessionService, private readonly api: IncidentApi) {
    if (this.session.user()) {
      void this.loadIncidents();
    }
  }

  async login() {
    this.loginMessage.set('');
    try {
      await this.session.login(this.email, this.password);
      await this.loadIncidents();
    } catch {
      this.loginMessage.set('Backend is not reachable. Use offline demo mode or start Docker Compose.');
    }
  }

  async startOfflineDemo() {
    this.session.startOfflineDemo();
    await this.loadIncidents();
  }

  async loadIncidents() {
    const incidents = await this.api.list(this.filters, this.session.offline());
    this.incidents.set(incidents);
    if (incidents.length > 0) {
      await this.select(incidents[0].id);
    } else {
      this.selected.set(null);
    }
  }

  async select(id: string) {
    this.selected.set(await this.api.detail(id, this.session.offline()));
    this.analysis.set(await this.api.latestAnalysis(id, this.session.offline()));
  }

  async setStatus(status: string) {
    const id = this.selected()?.incident.id;
    if (!id) return;
    await this.api.updateStatus(id, status as Status, this.session.offline());
    await this.select(id);
    await this.loadIncidents();
  }

  async requestAnalysis(id: string) {
    await this.api.requestAnalysis(id, this.session.offline());
    window.setTimeout(() => void this.select(id), 700);
  }

  async runArchitectureDemo() {
    this.activeArchitectureStep.set(0);
    architectureSteps.forEach((_, index) => {
      window.setTimeout(() => this.activeArchitectureStep.set(index), index * 700);
    });
    await this.ingestDemo();
  }

  async ingestDemo() {
    await this.api.ingestDemoLog(this.session.offline());
    window.setTimeout(() => void this.loadIncidents(), 800);
  }

  async copyPostmortem() {
    try {
      await navigator.clipboard.writeText(this.postmortemMarkdown());
      this.pushNotificationFeed('[local] Postmortem markdown copied to clipboard');
    } catch {
      this.pushNotificationFeed('[local] Clipboard blocked, markdown preview remains available');
    }
  }

  sendMockNotification() {
    const incident = this.selected()?.incident ?? this.incidents()[0] ?? demoIncidents[0];
    this.pushNotificationFeed(`[mock] Slack #prod-incidents <- ${incident.severity} ${incident.affectedService}: ${incident.title}`);
  }

  pushNotificationFeed(message: string) {
    this.notificationFeed.update(feed => [`${message} (${new Date().toLocaleTimeString()})`, ...feed].slice(0, 6));
  }

  filteredLogs() {
    const query = this.logQuery.toLowerCase();
    return demoLogs.filter(log =>
      (!this.logSeverity || log.severity === this.logSeverity) &&
      (!query || `${log.service} ${log.traceId} ${log.fingerprint} ${log.message}`.toLowerCase().includes(query))
    );
  }

  riskScore(incident: Incident) {
    const severity = { LOW: 20, MEDIUM: 45, HIGH: 70, CRITICAL: 95 }[incident.severity];
    return Math.min(100, severity + Math.min(incident.eventCount, 30));
  }

  formatTime(value: string) {
    return new Date(value).toLocaleString();
  }
}

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))]
}).catch(error => console.error(error));
