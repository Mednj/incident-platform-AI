package com.example.incidents.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "incident.ai")
public record AiAnalysisProperties(String provider, String model) {
}

