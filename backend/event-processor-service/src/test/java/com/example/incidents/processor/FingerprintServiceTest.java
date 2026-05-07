package com.example.incidents.processor;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FingerprintServiceTest {
    private final FingerprintService service = new FingerprintService();

    @Test
    void ignoresChangingIdsAndNumbers() {
        String first = service.fingerprint("billing", "prod", "ERROR", "NullPointerException",
                "NullPointerException order 123 failed for 550e8400-e29b-41d4-a716-446655440000");
        String second = service.fingerprint("billing", "prod", "ERROR", "NullPointerException",
                "NullPointerException order 999 failed for 8c8d9df2-8221-4f99-9c64-6c1767e2fb99");

        assertThat(first).isEqualTo(second);
    }
}

