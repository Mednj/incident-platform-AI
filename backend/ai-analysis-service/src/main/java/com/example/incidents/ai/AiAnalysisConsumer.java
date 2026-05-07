package com.example.incidents.ai;

import com.example.incidents.events.Topics;
import com.example.incidents.events.v1.AIAnalysisCompletedEvent;
import com.example.incidents.events.v1.AIAnalysisRequestedEvent;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
public class AiAnalysisConsumer {
    private final AiAnalysisRepository repository;
    private final AnalysisProvider provider;
    private final AiAnalysisProperties properties;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public AiAnalysisConsumer(AiAnalysisRepository repository, AnalysisProvider provider,
                              AiAnalysisProperties properties, KafkaTemplate<String, Object> kafkaTemplate) {
        this.repository = repository;
        this.provider = provider;
        this.properties = properties;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = Topics.AI_ANALYSIS_REQUESTED, groupId = "ai-analysis-service")
    public void onRequested(AIAnalysisRequestedEvent event) {
        UUID incidentId = UUID.fromString(event.getIncidentId());
        IncidentContext context = repository.incident(incidentId).orElseThrow();
        AiAnalysisResult result = provider.analyze(context);
        AnalysisView saved = repository.save(incidentId, result, providerName(), modelName());
        AIAnalysisCompletedEvent completed = AIAnalysisCompletedEvent.newBuilder()
                .setAnalysisId(saved.id().toString())
                .setIncidentId(incidentId.toString())
                .setSummary(saved.summary())
                .setLikelyCauses(saved.likelyCauses())
                .setRecommendedNextSteps(saved.recommendedNextSteps())
                .setConfidence(saved.confidence())
                .setReferencedLogIds(event.getRelevantLogIds())
                .setModelProvider(providerName())
                .setModelName(modelName())
                .setCompletedAt(Instant.now().toString())
                .build();
        kafkaTemplate.send(Topics.AI_ANALYSIS_COMPLETED, incidentId.toString(), completed);
    }

    private String providerName() {
        return properties.provider() == null ? "local" : properties.provider();
    }

    private String modelName() {
        return properties.model() == null ? "local-investigation-summary-v1" : properties.model();
    }
}

