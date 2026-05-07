package com.example.incidents.incident;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class IncidentRepository {
    private final JdbcTemplate jdbc;

    public IncidentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Optional<IncidentView> findOpenByFingerprint(String fingerprint) {
        return jdbc.query("""
                select * from incidents
                where fingerprint = ? and status in ('OPEN', 'INVESTIGATING', 'MITIGATED')
                order by created_at desc limit 1
                """, this::mapIncident, fingerprint).stream().findFirst();
    }

    IncidentView create(String title, IncidentSeverity severity, String service, String environment,
                        String fingerprint, String firstSeenAt, String lastSeenAt, String summary) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into incidents(id, title, severity, status, affected_service, environment, fingerprint,
                first_seen_at, last_seen_at, event_count, triggering_summary)
                values (?, ?, ?, 'OPEN', ?, ?, ?, ?::timestamptz, ?::timestamptz, 1, ?)
                """, id, title, severity.name(), service, environment, fingerprint, firstSeenAt, lastSeenAt, summary);
        addEvent(id, "CREATED", "Incident created from Kafka candidate");
        return findById(id).orElseThrow();
    }

    IncidentView increment(UUID id, String lastSeenAt, long eventCount) {
        jdbc.update("""
                update incidents
                set last_seen_at = ?::timestamptz, event_count = event_count + ?
                where id = ?
                """, lastSeenAt, eventCount, id);
        addEvent(id, "UPDATED", "Matching event grouped into incident");
        return findById(id).orElseThrow();
    }

    List<IncidentView> search(String status, String severity, String service) {
        return jdbc.query("""
                select * from incidents
                where (? is null or status = ?)
                  and (? is null or severity = ?)
                  and (? is null or affected_service = ?)
                order by last_seen_at desc
                limit 100
                """, this::mapIncident, blankToNull(status), blankToNull(status), blankToNull(severity),
                blankToNull(severity), blankToNull(service), blankToNull(service));
    }

    Optional<IncidentView> findById(UUID id) {
        return jdbc.query("select * from incidents where id = ?", this::mapIncident, id).stream().findFirst();
    }

    IncidentView updateStatus(UUID id, IncidentStatus status, String actor) {
        jdbc.update("update incidents set status = ? where id = ?", status.name(), id);
        addEvent(id, "STATUS_CHANGED", "Status changed to " + status + " by " + actor);
        return findById(id).orElseThrow();
    }

    IncidentView assign(UUID id, String assignee, String actor) {
        jdbc.update("update incidents set assignee = ? where id = ?", assignee, id);
        addEvent(id, "ASSIGNED", "Assigned to " + assignee + " by " + actor);
        return findById(id).orElseThrow();
    }

    void addComment(UUID id, String author, String body) {
        jdbc.update("insert into incident_comments(incident_id, author_email, body) values (?, ?, ?)", id, author, body);
        addEvent(id, "COMMENTED", author + " commented");
    }

    List<TimelineEvent> timeline(UUID id) {
        return jdbc.query("""
                select event_type, body, created_at from incident_events where incident_id = ?
                union all
                select 'COMMENT', author_email || ': ' || body, created_at from incident_comments where incident_id = ?
                order by created_at desc
                """, (rs, rowNum) -> new TimelineEvent(rs.getString("event_type"), rs.getString("body"),
                rs.getObject("created_at", OffsetDateTime.class)), id, id);
    }

    private void addEvent(UUID id, String type, String body) {
        jdbc.update("insert into incident_events(incident_id, event_type, body) values (?, ?, ?)", id, type, body);
    }

    private IncidentView mapIncident(ResultSet rs, int rowNum) throws SQLException {
        return new IncidentView(
                rs.getObject("id", UUID.class),
                rs.getString("title"),
                IncidentSeverity.valueOf(rs.getString("severity")),
                IncidentStatus.valueOf(rs.getString("status")),
                rs.getString("affected_service"),
                rs.getString("environment"),
                rs.getString("fingerprint"),
                rs.getObject("first_seen_at", OffsetDateTime.class),
                rs.getObject("last_seen_at", OffsetDateTime.class),
                rs.getLong("event_count"),
                rs.getString("assignee"),
                rs.getString("triggering_summary")
        );
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}

