package com.example.incidents.ingestion;

import com.example.incidents.events.Topics;
import com.example.incidents.events.v1.LogReceivedEvent;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.MediaType;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/logs")
public class LogIngestionController {
    private final KafkaTemplate<String, LogReceivedEvent> kafkaTemplate;

    public LogIngestionController(KafkaTemplate<String, LogReceivedEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    @PostMapping
    public IngestionResponse ingest(@Valid @RequestBody LogIngestionRequest request) {
        LogReceivedEvent event = toEvent(request, "HTTP");
        kafkaTemplate.send(Topics.LOGS_RECEIVED, event.getLogId(), event);
        return new IngestionResponse(event.getLogId(), "accepted");
    }

    @PostMapping("/batch")
    public BatchIngestionResponse ingestBatch(@RequestBody List<@Valid LogIngestionRequest> requests) {
        List<String> ids = new ArrayList<>();
        for (LogIngestionRequest request : requests) {
            LogReceivedEvent event = toEvent(request, "HTTP_BATCH");
            kafkaTemplate.send(Topics.LOGS_RECEIVED, event.getLogId(), event);
            ids.add(event.getLogId());
        }
        return new BatchIngestionResponse(ids.size(), ids);
    }

    @PostMapping(path = "/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BatchIngestionResponse ingestFile(@RequestPart("file") MultipartFile file,
                                             @RequestPart("application") String application,
                                             @RequestPart("environment") String environment) throws IOException {
        String content = new String(file.getBytes(), StandardCharsets.UTF_8);
        List<String> ids = content.lines()
                .filter(line -> !line.isBlank())
                .map(line -> new LogIngestionRequest(application, environment, "ERROR", Instant.now().toString(),
                        null, null, null, line, Map.of()))
                .map(request -> toEvent(request, "FILE_UPLOAD"))
                .peek(event -> kafkaTemplate.send(Topics.LOGS_RECEIVED, event.getLogId(), event))
                .map(LogReceivedEvent::getLogId)
                .toList();
        return new BatchIngestionResponse(ids.size(), ids);
    }

    private static LogReceivedEvent toEvent(LogIngestionRequest request, String sourceType) {
        return LogReceivedEvent.newBuilder()
                .setLogId(UUID.randomUUID().toString())
                .setApplication(request.application())
                .setEnvironment(request.environment())
                .setSeverity(request.severity())
                .setOccurredAt(request.occurredAt() == null || request.occurredAt().isBlank()
                        ? Instant.now().toString()
                        : request.occurredAt())
                .setTraceId(request.traceId())
                .setSpanId(request.spanId())
                .setHost(request.host())
                .setMessage(request.message())
                .setAttributes(request.attributes() == null ? Map.of() : request.attributes())
                .setSourceType(sourceType)
                .build();
    }

    public record LogIngestionRequest(
            @NotBlank String application,
            @NotBlank String environment,
            @NotBlank String severity,
            String occurredAt,
            String traceId,
            String spanId,
            String host,
            @NotBlank String message,
            Map<String, String> attributes
    ) {
    }

    public record IngestionResponse(String logId, String status) {
    }

    public record BatchIngestionResponse(int accepted, List<String> logIds) {
    }
}

