package com.example.incidents.incident;

import com.example.incidents.events.Topics;
import com.example.incidents.events.v1.AIAnalysisRequestedEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {
    private final IncidentRepository repository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public IncidentController(IncidentRepository repository, KafkaTemplate<String, Object> kafkaTemplate) {
        this.repository = repository;
        this.kafkaTemplate = kafkaTemplate;
    }

    @GetMapping
    public List<IncidentView> list(@RequestParam(required = false) String status,
                                   @RequestParam(required = false) String severity,
                                   @RequestParam(required = false) String service) {
        return repository.search(status, severity, service);
    }

    @GetMapping("/{id}")
    public IncidentDetail detail(@PathVariable UUID id) {
        IncidentView incident = repository.findById(id).orElseThrow();
        return new IncidentDetail(incident, repository.timeline(id));
    }

    @PatchMapping("/{id}/status")
    public IncidentView updateStatus(@PathVariable UUID id, @RequestBody StatusRequest request, Authentication auth) {
        return repository.updateStatus(id, request.status(), auth.getName());
    }

    @PatchMapping("/{id}/assignment")
    public IncidentView assign(@PathVariable UUID id, @RequestBody AssignmentRequest request, Authentication auth) {
        return repository.assign(id, request.assignee(), auth.getName());
    }

    @PostMapping("/{id}/comments")
    public void comment(@PathVariable UUID id, @RequestBody CommentRequest request, Authentication auth) {
        repository.addComment(id, auth.getName(), request.body());
    }

    @PostMapping("/{id}/ai-analysis")
    public AnalysisRequestResponse requestAnalysis(@PathVariable UUID id, Authentication auth) {
        IncidentView incident = repository.findById(id).orElseThrow();
        String requestId = UUID.randomUUID().toString();
        AIAnalysisRequestedEvent event = AIAnalysisRequestedEvent.newBuilder()
                .setRequestId(requestId)
                .setIncidentId(incident.id().toString())
                .setAnalysisType("INCIDENT_SUMMARY")
                .setRequestedBy(auth.getName())
                .setRelevantLogIds(List.of())
                .setContextWindowMinutes(60)
                .setRequestedAt(Instant.now().toString())
                .build();
        kafkaTemplate.send(Topics.AI_ANALYSIS_REQUESTED, incident.id().toString(), event);
        return new AnalysisRequestResponse(requestId, "queued");
    }

    public record IncidentDetail(IncidentView incident, List<TimelineEvent> timeline) {
    }

    public record StatusRequest(IncidentStatus status) {
    }

    public record AssignmentRequest(String assignee) {
    }

    public record CommentRequest(String body) {
    }

    public record AnalysisRequestResponse(String requestId, String status) {
    }
}

