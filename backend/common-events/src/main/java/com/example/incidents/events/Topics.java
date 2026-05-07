package com.example.incidents.events;

public final class Topics {
    public static final String LOGS_RECEIVED = "logs.received.v1";
    public static final String LOGS_NORMALIZED = "logs.normalized.v1";
    public static final String INCIDENT_CANDIDATES = "incidents.candidates.v1";
    public static final String INCIDENTS_CREATED = "incidents.created.v1";
    public static final String AI_ANALYSIS_REQUESTED = "ai.analysis.requested.v1";
    public static final String AI_ANALYSIS_COMPLETED = "ai.analysis.completed.v1";

    private Topics() {
    }
}

