package com.example.incidents.incident;

import java.time.OffsetDateTime;

public record TimelineEvent(String type, String body, OffsetDateTime createdAt) {
}

