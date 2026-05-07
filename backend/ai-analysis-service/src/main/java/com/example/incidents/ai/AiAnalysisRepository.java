package com.example.incidents.ai;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AiAnalysisRepository {
    private final JdbcTemplate jdbc;

    public AiAnalysisRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Optional<IncidentContext> incident(UUID id) {
        return jdbc.query("""
                select id, title, severity, status, affected_service, environment, event_count, triggering_summary
                from incidents where id = ?
                """, this::mapContext, id).stream().findFirst();
    }

    AnalysisView save(UUID incidentId, AiAnalysisResult result, String provider, String model) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into ai_analysis(id, incident_id, summary, likely_causes, recommended_next_steps,
                confidence, model_provider, model_name)
                values (?, ?, ?, ?::text[], ?::text[], ?, ?, ?)
                """, id, incidentId, result.summary(), toPgArray(result.likelyCauses()),
                toPgArray(result.recommendedNextSteps()), result.confidence(), provider, model);
        return latest(incidentId).orElseThrow();
    }

    Optional<AnalysisView> latest(UUID incidentId) {
        return jdbc.query("""
                select id, incident_id, summary, likely_causes, recommended_next_steps, confidence,
                model_provider, model_name, created_at
                from ai_analysis where incident_id = ? order by created_at desc limit 1
                """, this::mapAnalysis, incidentId).stream().findFirst();
    }

    private IncidentContext mapContext(ResultSet rs, int rowNum) throws SQLException {
        return new IncidentContext(rs.getObject("id", UUID.class), rs.getString("title"),
                rs.getString("severity"), rs.getString("status"), rs.getString("affected_service"),
                rs.getString("environment"), rs.getLong("event_count"), rs.getString("triggering_summary"));
    }

    private AnalysisView mapAnalysis(ResultSet rs, int rowNum) throws SQLException {
        return new AnalysisView(rs.getObject("id", UUID.class), rs.getObject("incident_id", UUID.class),
                rs.getString("summary"), arrayToList(rs.getArray("likely_causes")),
                arrayToList(rs.getArray("recommended_next_steps")), rs.getDouble("confidence"),
                rs.getString("model_provider"), rs.getString("model_name"),
                rs.getObject("created_at", OffsetDateTime.class));
    }

    private static String toPgArray(List<String> values) {
        return "{" + String.join(",", values.stream().map(value -> "\"" + value.replace("\"", "\\\"") + "\"").toList()) + "}";
    }

    private static List<String> arrayToList(Array array) throws SQLException {
        if (array == null) {
            return List.of();
        }
        return Arrays.stream((String[]) array.getArray()).toList();
    }
}

