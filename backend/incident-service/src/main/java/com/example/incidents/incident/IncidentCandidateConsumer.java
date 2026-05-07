package com.example.incidents.incident;

import com.example.incidents.events.Topics;
import com.example.incidents.events.v1.IncidentCandidateEvent;
import com.example.incidents.events.v1.IncidentCreatedEvent;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class IncidentCandidateConsumer {
    private final IncidentRepository repository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public IncidentCandidateConsumer(IncidentRepository repository, KafkaTemplate<String, Object> kafkaTemplate) {
        this.repository = repository;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = Topics.INCIDENT_CANDIDATES, groupId = "incident-service")
    public void onCandidate(IncidentCandidateEvent candidate) {
        repository.findOpenByFingerprint(candidate.getFingerprint())
                .ifPresentOrElse(existing -> repository.increment(existing.id(), candidate.getLastSeenAt(), candidate.getEventCount()),
                        () -> createIncident(candidate));
    }

    private void createIncident(IncidentCandidateEvent candidate) {
        IncidentView incident = repository.create(
                titleFor(candidate),
                IncidentSeverity.fromLogSeverity(candidate.getSeverity()),
                candidate.getAffectedService(),
                candidate.getEnvironment(),
                candidate.getFingerprint(),
                candidate.getFirstSeenAt(),
                candidate.getLastSeenAt(),
                candidate.getSampleMessage()
        );
        IncidentCreatedEvent event = IncidentCreatedEvent.newBuilder()
                .setIncidentId(incident.id().toString())
                .setTitle(incident.title())
                .setSeverity(incident.severity().name())
                .setStatus(incident.status().name())
                .setAffectedService(incident.affectedService())
                .setEnvironment(incident.environment())
                .setFingerprint(incident.fingerprint())
                .setCreatedAt(incident.firstSeenAt().toString())
                .setFirstSeenAt(incident.firstSeenAt().toString())
                .setLastSeenAt(incident.lastSeenAt().toString())
                .setTriggeringSummary(incident.triggeringSummary())
                .build();
        kafkaTemplate.send(Topics.INCIDENTS_CREATED, incident.id().toString(), event);
    }

    private static String titleFor(IncidentCandidateEvent candidate) {
        String message = candidate.getSampleMessage();
        String shortMessage = message.length() <= 80 ? message : message.substring(0, 77) + "...";
        return candidate.getAffectedService() + " " + candidate.getSeverity() + ": " + shortMessage;
    }
}

