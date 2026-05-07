FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY . .
RUN mvn -pl notification-service -am -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /workspace/notification-service/target/notification-service-*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

