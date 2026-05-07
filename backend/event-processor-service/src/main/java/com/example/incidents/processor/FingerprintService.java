package com.example.incidents.processor;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class FingerprintService {
    private static final Pattern UUID_PATTERN = Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\b\\d+\\b");

    public String fingerprint(String service, String environment, String severity, String errorClass, String message) {
        String normalizedMessage = NUMBER_PATTERN.matcher(UUID_PATTERN.matcher(message).replaceAll("{uuid}")).replaceAll("{number}");
        return sha256((service + "|" + environment + "|" + severity + "|" + nullSafe(errorClass) + "|" + normalizedMessage)
                .toLowerCase(Locale.ROOT));
    }

    public String errorClass(String message) {
        int index = message.indexOf("Exception");
        if (index < 0) {
            index = message.indexOf("Error");
        }
        if (index < 0) {
            return null;
        }
        int start = Math.max(0, message.lastIndexOf(' ', index) + 1);
        int end = Math.min(message.length(), index + (message.startsWith("Exception", index) ? 9 : 5));
        return message.substring(start, end).replace(":", "");
    }

    public String stackTraceHash(String message) {
        return message.contains("at ") ? sha256(message) : null;
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8))).substring(0, 24);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }
}

