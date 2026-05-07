package com.example.incidents.processor;

import com.example.incidents.events.Topics;
import com.example.incidents.events.v1.IncidentCandidateEvent;
import com.example.incidents.events.v1.LogNormalizedEvent;
import com.example.incidents.events.v1.LogReceivedEvent;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class LogEventProcessor {
    private final FingerprintService fingerprintService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public LogEventProcessor(FingerprintService fingerprintService, KafkaTemplate<String, Object> kafkaTemplate) {
        this.fingerprintService = fingerprintService;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = Topics.LOGS_RECEIVED, groupId = "event-processor-service")
    public void onLogReceived(LogReceivedEvent event) {
        String errorClass = fingerprintService.errorClass(event.getMessage());
        String stackTraceHash = fingerprintService.stackTraceHash(event.getMessage());
        String fingerprint = fingerprintService.fingerprint(
                event.getApplication(), event.getEnvironment(), event.getSeverity(), errorClass, event.getMessage());

        LogNormalizedEvent normalized = LogNormalizedEvent.newBuilder()
                .setLogId(event.getLogId())
                .setService(event.getApplication())
                .setEnvironment(event.getEnvironment())
                .setSeverity(event.getSeverity())
                .setOccurredAt(event.getOccurredAt())
                .setTraceId(event.getTraceId())
                .setSpanId(event.getSpanId())
                .setMessage(event.getMessage())
                .setErrorClass(errorClass)
                .setStackTraceHash(stackTraceHash)
                .setFingerprint(fingerprint)
                .setFields(event.getAttributes() == null ? Map.of() : event.getAttributes())
                .build();

        kafkaTemplate.send(Topics.LOGS_NORMALIZED, event.getLogId(), normalized);

        if (isIncidentWorthy(event.getSeverity())) {
            IncidentCandidateEvent candidate = IncidentCandidateEvent.newBuilder()
                    .setCandidateId(UUID.randomUUID().toString())
                    .setFingerprint(fingerprint)
                    .setAffectedService(event.getApplication())
                    .setEnvironment(event.getEnvironment())
                    .setSeverity(event.getSeverity())
                    .setFirstSeenAt(event.getOccurredAt())
                    .setLastSeenAt(event.getOccurredAt())
                    .setSampleLogIds(List.of(event.getLogId()))
                    .setSampleMessage(event.getMessage())
                    .setEventCount(1L)
                    .setGroupingReason(errorClass == null ? "message-pattern" : "error-class-and-message-pattern")
                    .build();
            kafkaTemplate.send(Topics.INCIDENT_CANDIDATES, fingerprint, candidate);
        }
    }

    private static boolean isIncidentWorthy(String severity) {
        return severity != null && List.of("ERROR", "CRITICAL", "FATAL", "HIGH").contains(severity.toUpperCase());
    }
}

