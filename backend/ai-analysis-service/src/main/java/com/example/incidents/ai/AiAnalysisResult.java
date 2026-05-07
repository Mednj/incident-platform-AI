package com.example.incidents.ai;

import java.util.List;

public record AiAnalysisResult(
        String summary,
        List<String> likelyCauses,
        List<String> recommendedNextSteps,
        double confidence
) {
}

