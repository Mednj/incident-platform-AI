import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Component, computed, Injectable, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { authInterceptor } from './shared/auth.interceptor';
import { firstValueFrom } from 'rxjs';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Status = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';

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

@Injectable({ providedIn: 'root' })
class SessionService {
  user = signal<LoginResponse | null>(this.readUser());

  constructor(private readonly http: HttpClient) {}

  async login(email: string, password: string) {
    const response = await firstValueFrom(this.http.post<LoginResponse>('http://localhost:8086/api/auth/login', { email, password }));
    localStorage.setItem('incident-platform-session', JSON.stringify(response));
    this.user.set(response);
  }

  logout() {
    localStorage.removeItem('incident-platform-session');
    this.user.set(null);
  }

  token() {
    return this.user()?.token ?? null;
  }

  private readUser(): LoginResponse | null {
    const raw = localStorage.getItem('incident-platform-session');
    return raw ? JSON.parse(raw) as LoginResponse : null;
  }
}

@Injectable({ providedIn: 'root' })
class IncidentApi {
  constructor(private readonly http: HttpClient) {}

  list(filters: { status: string; severity: string; service: string }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return firstValueFrom(this.http.get<Incident[]>(`http://localhost:8083/api/incidents?${params.toString()}`));
  }

  detail(id: string) {
    return firstValueFrom(this.http.get<IncidentDetail>(`http://localhost:8083/api/incidents/${id}`));
  }

  updateStatus(id: string, status: Status) {
    return firstValueFrom(this.http.patch<Incident>(`http://localhost:8083/api/incidents/${id}/status`, { status }));
  }

  assign(id: string, assignee: string) {
    return firstValueFrom(this.http.patch<Incident>(`http://localhost:8083/api/incidents/${id}/assignment`, { assignee }));
  }

  requestAnalysis(id: string) {
    return firstValueFrom(this.http.post(`http://localhost:8083/api/incidents/${id}/ai-analysis`, {}));
  }

  latestAnalysis(id: string) {
    return firstValueFrom(this.http.get<Analysis | null>(`http://localhost:8084/api/ai/incidents/${id}/latest`));
  }

  ingestDemoLog() {
    return firstValueFrom(this.http.post('http://localhost:8081/api/logs', {
      application: 'checkout-api',
      environment: 'prod',
      severity: 'ERROR',
      occurredAt: new Date().toISOString(),
      traceId: crypto.randomUUID(),
      host: 'checkout-pod-7',
      message: 'PaymentProviderTimeoutException order 48291 failed while authorizing payment',
      attributes: { region: 'us-east-1', endpoint: '/checkout' }
    }));
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
          <h1>Production investigation workspace</h1>
          <form (ngSubmit)="login()" class="login-form">
            <label>Email <input name="email" [(ngModel)]="email"></label>
            <label>Password <input name="password" type="password" [(ngModel)]="password"></label>
            <button type="submit">Sign in</button>
          </form>
          <p class="hint">Demo: dev&#64;example.com / password</p>
        </section>
      </main>
    } @else {
      <main class="workspace">
        <aside class="sidebar">
          <div>
            <p class="eyebrow">Incident Platform AI</p>
            <h1>Investigation</h1>
          </div>
          <nav>
            <button [class.active]="tab() === 'incidents'" (click)="tab.set('incidents')">Incidents</button>
            <button [class.active]="tab() === 'logs'" (click)="tab.set('logs')">Log Search</button>
            <button [class.active]="tab() === 'admin'" (click)="tab.set('admin')">Services</button>
          </nav>
          <button class="ghost" (click)="session.logout()">Sign out</button>
        </aside>

        <section class="content">
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
                      <h3>AI analysis</h3>
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

          @if (tab() === 'logs') {
            <header class="toolbar">
              <div>
                <h2>Log search</h2>
                <p>Search UI placeholder wired to the ingestion and incident model.</p>
              </div>
              <button (click)="ingestDemo()">Send sample log</button>
            </header>
            <section class="empty-state">
              <h3>Kafka-backed search surface</h3>
              <p>The MVP records incident-driving logs and leaves full-text log indexing as a clean extension point.</p>
            </section>
          }

          @if (tab() === 'admin') {
            <header class="toolbar">
              <div>
                <h2>Service registry</h2>
                <p>Known applications for the portfolio demo.</p>
              </div>
            </header>
            <section class="service-grid">
              @for (service of ['checkout-api', 'billing-worker', 'identity-api']; track service) {
                <article>
                  <h3>{{ service }}</h3>
                  <p>Environment: prod</p>
                  <p>Owner: Platform team</p>
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
  tab = signal<'incidents' | 'logs' | 'admin'>('incidents');
  incidents = signal<Incident[]>([]);
  selected = signal<IncidentDetail | null>(null);
  analysis = signal<Analysis | null>(null);
  filters = { status: '', severity: '', service: '' };
  openCount = computed(() => this.incidents().filter(incident => ['OPEN', 'INVESTIGATING', 'MITIGATED'].includes(incident.status)).length);

  constructor(public readonly session: SessionService, private readonly api: IncidentApi) {
    if (this.session.user()) {
      void this.loadIncidents();
    }
  }

  async login() {
    await this.session.login(this.email, this.password);
    await this.loadIncidents();
  }

  async loadIncidents() {
    const incidents = await this.api.list(this.filters);
    this.incidents.set(incidents);
    if (incidents.length > 0) {
      await this.select(incidents[0].id);
    }
  }

  async select(id: string) {
    this.selected.set(await this.api.detail(id));
    this.analysis.set(await this.api.latestAnalysis(id));
  }

  async setStatus(status: string) {
    const id = this.selected()?.incident.id;
    if (!id) return;
    await this.api.updateStatus(id, status as Status);
    await this.select(id);
    await this.loadIncidents();
  }

  async requestAnalysis(id: string) {
    await this.api.requestAnalysis(id);
    window.setTimeout(() => void this.select(id), 1000);
  }

  async ingestDemo() {
    await this.api.ingestDemoLog();
    window.setTimeout(() => void this.loadIncidents(), 1500);
  }
}

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))]
}).catch(error => console.error(error));
