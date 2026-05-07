package com.example.incidents.ai;

import java.util.UUID;

public record IncidentContext(
        UUID incidentId,
        String title,
        String severity,
        String status,
        String affectedService,
        String environment,
        long eventCount,
        String triggeringSummary
) {
}

