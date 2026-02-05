# ===== Build stage =====
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests clean package

# ===== Runtime stage =====
FROM eclipse-temurin:21-jre
WORKDIR /app
# run as non-root
RUN useradd -r -u 1001 spring
USER spring
COPY --from=build /app/target/*.jar /app/app.jar
EXPOSE 8080
# tune memory for containers
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75.0","-jar","/app/app.jar"]
