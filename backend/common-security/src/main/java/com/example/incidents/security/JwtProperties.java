package com.example.incidents.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "incident.security.jwt")
public record JwtProperties(
        String secret,
        String issuer,
        long ttlMinutes
) {
    public JwtProperties {
        if (ttlMinutes <= 0) {
            ttlMinutes = 240;
        }
    }
}

