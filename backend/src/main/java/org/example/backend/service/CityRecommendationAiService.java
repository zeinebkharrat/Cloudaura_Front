package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.CityRecommendationRefinementRequest;
import org.example.backend.dto.CityRecommendationRefinementResponse;
import org.example.backend.repository.CityRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CityRecommendationAiService {

    private final ObjectMapper objectMapper;
    private final CityRepository cityRepository;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    public CityRecommendationRefinementResponse refineRecommendations(CityRecommendationRefinementRequest request) {
        try {
            String prompt = buildPrompt(request);
            String aiResponse = callGemini(prompt);
            return parseAiResponse(aiResponse, request);
        } catch (Exception e) {
            log.error("Error refining recommendations with Gemini", e);
            return fallbackResponse(request);
        }
    }

    private String buildPrompt(CityRecommendationRefinementRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert travel consultant for Tunisia. ");
        sb.append("I have a recommendation model that suggested some cities to a user, but it might be imprecise. ");
        sb.append("Your task is to review the user's preferences and the model's outputs, then provide a logically refined list of recommendations. \n\n");

        sb.append("USER PREFERENCES:\n");
        CityRecommendationRefinementRequest.TravelPreferenceDto p = request.getPreferences();
        sb.append("- Budget: ").append(p.getBudgetMin()).append(" to ").append(p.getBudgetMax()).append(" TND\n");
        sb.append("- Styles: ").append(p.getTravelStyles() != null ? String.join(", ", p.getTravelStyles()) : "N/A").append("\n");
        sb.append("- Region: ").append(p.getPreferredRegion()).append("\n");
        sb.append("- Cuisine: ").append(p.getPreferredCuisine()).append("\n");
        sb.append("- Traveling with: ").append(p.getTravelWith()).append("\n");
        sb.append("- Transport: ").append(p.getTransportPreference()).append("\n");
        sb.append("- Accommodation: ").append(p.getAccommodationType()).append("\n\n");

        sb.append("MODEL RECOMMENDATIONS (to be verified):\n");
        if (request.getRecommendations() != null) {
            for (int i = 0; i < request.getRecommendations().size(); i++) {
                CityRecommendationRefinementRequest.CityRecommendationDto r = request.getRecommendations().get(i);
                sb.append(i + 1).append(". ").append(r.getCityName()).append(" (Model Score: ").append(r.getPercentage()).append("%)\n");
                sb.append("   Context: ").append(r.getActivities()).append(", ").append(r.getEvent()).append("\n");
            }
        }

        sb.append("\nINSTRUCTIONS:\n");
        sb.append("1. Evaluate if each city truly matches the user's preferences based on its characteristics (geography, culture, activities).\n");
        sb.append("2. Adjust the scores (0-1) and percentages (0-100) to reflect the logical fit.\n");
        sb.append("3. Provide a brief logic reasoning for each city.\n");
        sb.append("4. If a city is completely illogical, lower its score significantly.\n");
        sb.append("5. You can re-rank them if necessary.\n");
        sb.append("6. Return ONLY a valid JSON object with the following structure:\n");
        sb.append("{\n");
        sb.append("  \"refinedRecommendations\": [\n");
        sb.append("    { \"cityName\": \"...\", \"refinedScore\": 0.95, \"refinedPercentage\": 95.0, \"logicReasoning\": \"...\" }\n");
        sb.append("  ],\n");
        sb.append("  \"aiExplanation\": \"Overall summary of changes...\"\n");
        sb.append("}\n");

        return sb.toString();
    }

    private String callGemini(String prompt) throws IOException, InterruptedException {
        String base = geminiBaseUrl.endsWith("/") ? geminiBaseUrl.substring(0, geminiBaseUrl.length() - 1) : geminiBaseUrl;
        String modelPath = geminiModel.startsWith("models/") ? geminiModel : "models/" + geminiModel;
        String endpoint = base + "/" + modelPath + ":generateContent?key=" + URLEncoder.encode(geminiApiKey, StandardCharsets.UTF_8);

        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode contents = root.putArray("contents");
        ObjectNode content = contents.addObject();
        ArrayNode parts = content.putArray("parts");
        parts.addObject().put("text", prompt);

        ObjectNode generationConfig = root.putObject("generationConfig");
        generationConfig.put("temperature", 0.2);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)))
                .build();

        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new RuntimeException("Gemini API call failed with status " + response.statusCode() + ": " + response.body());
        }

        JsonNode resNode = objectMapper.readTree(response.body());
        return extractText(resNode);
    }

    private String extractText(JsonNode root) {
        try {
            return root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
        } catch (Exception e) {
            return "";
        }
    }

    private CityRecommendationRefinementResponse parseAiResponse(String aiText, CityRecommendationRefinementRequest originalRequest) {
        try {
            String json = aiText.replaceAll("```json", "").replaceAll("```", "").trim();
            return objectMapper.readValue(json, CityRecommendationRefinementResponse.class);
        } catch (Exception e) {
            log.error("Failed to parse Gemini JSON response", e);
            return fallbackResponse(originalRequest);
        }
    }

    private CityRecommendationRefinementResponse fallbackResponse(CityRecommendationRefinementRequest request) {
        if (request.getRecommendations() == null) {
            return CityRecommendationRefinementResponse.builder()
                    .aiExplanation("No recommendations to refine.")
                    .build();
        }
        List<CityRecommendationRefinementResponse.CityRecommendationRefinedDto> refined = request.getRecommendations().stream()
                .map(r -> CityRecommendationRefinementResponse.CityRecommendationRefinedDto.builder()
                        .cityName(r.getCityName())
                        .refinedScore(r.getScore())
                        .refinedPercentage(r.getPercentage())
                        .logicReasoning("Original model prediction (AI refinement failed).")
                        .build())
                .collect(Collectors.toList());

        return CityRecommendationRefinementResponse.builder()
                .refinedRecommendations(refined)
                .aiExplanation("AI refinement failed, returning original model results.")
                .build();
    }
}
