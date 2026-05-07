FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY . .
RUN mvn -pl event-processor-service -am -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /workspace/event-processor-service/target/event-processor-service-*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

