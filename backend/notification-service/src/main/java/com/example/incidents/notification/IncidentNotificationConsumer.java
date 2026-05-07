package com.example.incidents.notification;

import com.example.incidents.events.Topics;
import com.example.incidents.events.v1.IncidentCreatedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class IncidentNotificationConsumer {
    private static final Logger log = LoggerFactory.getLogger(IncidentNotificationConsumer.class);

    @KafkaListener(topics = Topics.INCIDENTS_CREATED, groupId = "notification-service")
    public void onIncidentCreated(IncidentCreatedEvent event) {
        log.info("New {} incident {} for {} in {}: {}",
                event.getSeverity(), event.getIncidentId(), event.getAffectedService(),
                event.getEnvironment(), event.getTitle());
    }
}

