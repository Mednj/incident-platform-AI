package com.example.incidents.ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.EnableKafka;

@EnableKafka
@SpringBootApplication(scanBasePackages = "com.example.incidents")
public class AiAnalysisApplication {
    public static void main(String[] args) {
        SpringApplication.run(AiAnalysisApplication.class, args);
    }
}

