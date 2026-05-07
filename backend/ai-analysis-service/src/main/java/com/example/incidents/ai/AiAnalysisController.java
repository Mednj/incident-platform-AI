package com.example.incidents.ai;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AiAnalysisController {
    private final AiAnalysisRepository repository;

    public AiAnalysisController(AiAnalysisRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/incidents/{incidentId}/latest")
    public AnalysisView latest(@PathVariable UUID incidentId) {
        return repository.latest(incidentId).orElse(null);
    }
}

