package com.example.incidents.processor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.EnableKafka;

@EnableKafka
@SpringBootApplication(scanBasePackages = "com.example.incidents")
public class EventProcessorApplication {
    public static void main(String[] args) {
        SpringApplication.run(EventProcessorApplication.class, args);
    }
}

