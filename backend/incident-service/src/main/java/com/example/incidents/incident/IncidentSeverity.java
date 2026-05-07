package com.example.incidents.incident;

public enum IncidentSeverity {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL;

    public static IncidentSeverity fromLogSeverity(String severity) {
        if (severity == null) {
            return MEDIUM;
        }
        return switch (severity.toUpperCase()) {
            case "FATAL", "CRITICAL" -> CRITICAL;
            case "ERROR", "HIGH" -> HIGH;
            case "WARN", "WARNING", "MEDIUM" -> MEDIUM;
            default -> LOW;
        };
    }
}

