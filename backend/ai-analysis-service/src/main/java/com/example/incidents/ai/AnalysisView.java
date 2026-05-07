package com.example.incidents.ai;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AnalysisView(
        UUID id,
        UUID incidentId,
        String summary,
        List<String> likelyCauses,
        List<String> recommendedNextSteps,
        double confidence,
        String modelProvider,
        String modelName,
        OffsetDateTime createdAt
) {
}

