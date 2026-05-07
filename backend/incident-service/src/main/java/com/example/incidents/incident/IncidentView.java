package com.example.incidents.incident;

import java.time.OffsetDateTime;
import java.util.UUID;

public record IncidentView(
        UUID id,
        String title,
        IncidentSeverity severity,
        IncidentStatus status,
        String affectedService,
        String environment,
        String fingerprint,
        OffsetDateTime firstSeenAt,
        OffsetDateTime lastSeenAt,
        long eventCount,
        String assignee,
        String triggeringSummary
) {
}

