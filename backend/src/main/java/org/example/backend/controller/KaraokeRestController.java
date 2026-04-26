package org.example.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.KaraokeSong;
import org.example.backend.repository.KaraokeSongRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/games/karaoke")
@RequiredArgsConstructor
@Slf4j
public class KaraokeRestController {

    private final KaraokeSongRepository repository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.karaoke.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.groq.api-key:}")
    private String groqApiKey;

    @GetMapping("/songs")
    public List<KaraokeSong> getPublishedSongs() {
        return repository.findByPublishedTrue();
    }

    @GetMapping("/admin/songs")
    @PreAuthorize("hasRole('ADMIN')")
    public List<KaraokeSong> getAllSongs() {
        return repository.findAll();
    }

    @PostMapping("/admin/songs")
    @PreAuthorize("hasRole('ADMIN')")
    public KaraokeSong saveSong(@RequestBody KaraokeSong song) {
        return repository.save(song);
    }

    @DeleteMapping("/admin/songs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteSong(@PathVariable Long id) {
        repository.deleteById(id);
    }

    @PostMapping("/admin/generate-lyrics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> generateLyrics(@RequestBody Map<String, String> request) {
        String title = request.get("title");
        String artist = request.get("artist");
        String lyricsText = request.get("lyricsText");

        if (title == null || artist == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Title and Artist are required"));
        }

        String prompt;
        if (lyricsText != null && !lyricsText.isBlank()) {
            prompt = "Convert these lyrics for the song '" + title + "' by '" + artist + "' into synchronized JSON format for a Karaoke game:\n\n" + lyricsText + "\n\n" +
                    "Return a JSON object with a key 'lyrics' containing an array of objects. " +
                    "Each object must have: 'text' (string), 'start' (number, seconds), and 'end' (number, seconds). " +
                    "Space them realistically over the song duration.";
        } else {
            prompt = "Generate the EXACT FULL synchronized lyrics for the Tunisian song '" + title + "' by '" + artist + "'. " +
                    "Search for actual Tunisian Arabic (Derja) lyrics in Latin characters (chat style like 3, 7, 9). " +
                    "Return a JSON object with a key 'lyrics' containing an array of objects. " +
                    "Each object: 'text', 'start' (sec), 'end' (sec). Cover the entire song.";
        }

        // --- TRY GEMINI FIRST ---
        List<String> geminiModels = List.of("gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro");
        for (String model : geminiModels) {
            try {
                log.info("Trying Gemini model: {}", model);
                String url = "https://generativelanguage.googleapis.com/v1/models/" + model + ":generateContent?key=" + geminiApiKey;
                Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", Map.of("responseMimeType", "application/json")
                );
                ResponseEntity<JsonNode> res = restTemplate.postForEntity(url, body, JsonNode.class);
                String content = res.getBody().path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
                return parseAndReturnLyrics(content);
            } catch (Exception e) {
                log.warn("Gemini model {} failed: {}", model, e.getMessage());
            }
        }

        // --- TRY GROQ AS FALLBACK ---
        if (groqApiKey != null && !groqApiKey.isBlank()) {
            try {
                log.info("Trying Groq fallback (Llama 3.3)...");
                String url = "https://api.groq.com/openai/v1/chat/completions";
                Map<String, Object> body = Map.of(
                    "model", "llama-3.3-70b-versatile",
                    "messages", List.of(
                        Map.of("role", "system", "content", "You are a musical expert. Always return JSON."),
                        Map.of("role", "user", "content", prompt)
                    ),
                    "response_format", Map.of("type", "json_object")
                );
                HttpHeaders headers = new HttpHeaders();
                headers.set("Authorization", "Bearer " + groqApiKey);
                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
                ResponseEntity<JsonNode> res = restTemplate.postForEntity(url, entity, JsonNode.class);
                String content = res.getBody().path("choices").get(0).path("message").path("content").asText();
                return parseAndReturnLyrics(content);
            } catch (Exception e) {
                log.error("Groq fallback also failed: {}", e.getMessage());
            }
        }

        return ResponseEntity.status(500).body(Map.of("error", "All AI providers (Gemini & Groq) failed."));
    }

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @PostMapping("/admin/transcribe")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> transcribeAudio(@RequestBody Map<String, String> request) {
        String audioUrl = request.get("audioUrl");
        String title = request.get("title");
        String artist = request.get("artist");
        
        if (audioUrl == null || audioUrl.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "audioUrl is required"));
        }

        try {
            // Locate the file on disk
            String relativePath = audioUrl.startsWith("/") ? audioUrl.substring(1) : audioUrl;
            Path filePath = Paths.get(relativePath).toAbsolutePath().normalize();
            File file = filePath.toFile();

            if (!file.exists()) {
                filePath = Paths.get(uploadDir, relativePath.replace("uploads/", "")).toAbsolutePath().normalize();
                file = filePath.toFile();
            }

            if (!file.exists()) {
                return ResponseEntity.status(404).body(Map.of("error", "File not found", "path", filePath.toString()));
            }

            log.info("Transcribing {} - {} from file: {}", artist, title, file.getAbsolutePath());

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + groqApiKey);
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new FileSystemResource(file));
            body.add("model", "whisper-large-v3");
            body.add("response_format", "verbose_json");
            body.add("language", "ar");
            body.add("temperature", "0");
            body.add("prompt", "Transcrire les paroles de la chanson tunisienne '" + title + "' de '" + artist + "'.");

            HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(body, headers);
            String whisperUrl = "https://api.groq.com/openai/v1/audio/transcriptions";
            
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(whisperUrl, entity, JsonNode.class);
            JsonNode segments = response.getBody().path("segments");

            StringBuilder rawTranscription = new StringBuilder();
            if (segments.isArray()) {
                for (JsonNode segment : segments) {
                    rawTranscription.append(String.format("[%f - %f] %s\n", 
                        segment.path("start").asDouble(), 
                        segment.path("end").asDouble(), 
                        segment.path("text").asText()));
                }
            }

            // --- SECOND PASS: Knowledge-Enhanced Cleaning ---
            String cleaningPrompt = "You are an expert in Tunisian music. Correct the following raw transcription for the song '" + title + "' by '" + artist + "'.\n" +
                    "1. Use your KNOWLEDGE of the actual lyrics of this specific song to fix errors.\n" +
                    "2. Convert everything to Latin Tunisian chat style (3, 7, 9).\n" +
                    "3. Maintain the EXACT timestamps provided.\n" +
                    "4. Return a JSON array of objects: {text, start, end}.\n\n" +
                    "Raw Transcription:\n" + rawTranscription.toString();

            String geminiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
            Map<String, Object> geminiBody = Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", cleaningPrompt)))),
                "generationConfig", Map.of("responseMimeType", "application/json")
            );

            try {
                ResponseEntity<JsonNode> geminiRes = restTemplate.postForEntity(geminiUrl, geminiBody, JsonNode.class);
                String cleanContent = geminiRes.getBody().path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
                return parseAndReturnLyrics(cleanContent);
            } catch (Exception e) {
                log.warn("Gemini cleaning failed, returning raw Whisper segments", e);
                // Fallback to raw whisper if cleaning fails
                List<Map<String, Object>> lyrics = new java.util.ArrayList<>();
                for (JsonNode segment : segments) {
                    Map<String, Object> lyre = new java.util.HashMap<>();
                    lyre.put("text", segment.path("text").asText().trim());
                    lyre.put("start", segment.path("start").asDouble());
                    lyre.put("end", segment.path("end").asDouble());
                    lyrics.add(lyre);
                }
                return ResponseEntity.ok(Map.of("lyrics", objectMapper.writeValueAsString(lyrics)));
            }

        } catch (Exception e) {
            log.error("Transcription failed", e);
            return ResponseEntity.status(500).body(Map.of("error", "Transcription failed", "message", e.getMessage()));
        }
    }

    private ResponseEntity<?> parseAndReturnLyrics(String content) {
        try {
            content = content.trim();
            // Strip markdown if present
            if (content.startsWith("```json")) content = content.substring(7);
            else if (content.startsWith("```")) content = content.substring(3);
            if (content.endsWith("```")) content = content.substring(0, content.length() - 3);
            content = content.trim();

            JsonNode root = objectMapper.readTree(content);
            if (root.has("lyrics")) {
                return ResponseEntity.ok(Map.of("lyrics", root.get("lyrics").toString()));
            }
            return ResponseEntity.ok(Map.of("lyrics", content));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("lyrics", content));
        }
    }
}
