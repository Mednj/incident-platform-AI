package com.example.incidents.ai;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class LocalAnalysisProvider implements AnalysisProvider {
    @Override
    public AiAnalysisResult analyze(IncidentContext context) {
        String summary = "Incident " + context.title() + " is affecting " + context.affectedService()
                + " in " + context.environment() + " with " + context.eventCount() + " grouped events.";
        return new AiAnalysisResult(summary,
                List.of("Repeated failures share the same fingerprint", "The triggering log points to a service-level failure path"),
                List.of("Inspect recent deploys for " + context.affectedService(),
                        "Check traces and upstream dependency health around the first seen time",
                        "Move the incident to INVESTIGATING and attach owner findings"),
                0.72);
    }
}

