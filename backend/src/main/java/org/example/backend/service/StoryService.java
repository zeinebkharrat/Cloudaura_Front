package org.example.backend.service;

import org.example.backend.dto.StoryInteractionUserResponse;
import org.example.backend.dto.StoryResponse;
import org.example.backend.model.*;
import org.example.backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class StoryService implements IStoryService {

    private final StoryRepository storyRepository;
    private final StoryMediaRepository storyMediaRepository;
    private final StoryViewRepository storyViewRepository;
    private final StoryLikeRepository storyLikeRepository;
    private final UserRepository userRepository;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public StoryService(
            StoryRepository storyRepository,
            StoryMediaRepository storyMediaRepository,
            StoryViewRepository storyViewRepository,
            StoryLikeRepository storyLikeRepository,
            UserRepository userRepository
    ) {
        this.storyRepository = storyRepository;
        this.storyMediaRepository = storyMediaRepository;
        this.storyViewRepository = storyViewRepository;
        this.storyLikeRepository = storyLikeRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public StoryResponse createStory(Integer authorUserId, MultipartFile file, String caption, String visibility, String mediaType) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Story media file is required");
        }

        User author = userRepository.findById(authorUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Date now = new Date();
        Date expiresAt = Date.from(Instant.now().plus(24, ChronoUnit.HOURS));

        Story story = new Story();
        story.setAuthor(author);
        story.setCaption(trimToNull(caption));
        story.setVisibility(parseVisibility(visibility));
        story.setStatus(StoryStatus.ACTIVE);
        story.setCreatedAt(now);
        story.setExpiresAt(expiresAt);
        story.setViewsCount(0);
        story.setLikesCount(0);
        story = storyRepository.save(story);

        StoryMedia sm = new StoryMedia();
        sm.setStory(story);
        sm.setMediaType(parseMediaType(file, mediaType));
        sm.setOrderIndex(0);
        sm.setUploadedAt(now);
        sm.setFileUrl(storeStoryFile(file));
        storyMediaRepository.save(sm);

        Story withGraph = storyRepository.findByIdWithGraph(story.getStoryId())
                .orElse(story);
        return toResponse(withGraph, authorUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoryResponse> getFeedStories(Integer currentUserIdOrNull) {
        Date now = new Date();
        List<Story> stories = storyRepository.findActiveFeedWithGraph(now);
        return stories.stream().map(s -> toResponse(s, currentUserIdOrNull)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoryResponse> getMyStories(Integer userId) {
        List<Story> stories = storyRepository.findByAuthorWithGraph(userId);
        Date now = new Date();
        return stories.stream()
                .filter(s -> s.getStatus() == StoryStatus.ACTIVE && s.getExpiresAt() != null && s.getExpiresAt().after(now))
                .map(s -> toResponse(s, userId))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoryResponse> getMyArchive(Integer userId) {
        List<Story> stories = storyRepository.findByAuthorWithGraph(userId);
        Date now = new Date();
        return stories.stream()
                .filter(s -> s.getStatus() != StoryStatus.ACTIVE || s.getExpiresAt() == null || !s.getExpiresAt().after(now))
                .map(s -> toResponse(s, userId))
                .toList();
    }

    @Override
    @Transactional
    public StoryResponse markViewed(Integer storyId, Integer viewerUserId) {
        Story story = loadActiveStory(storyId);
        User viewer = userRepository.findById(viewerUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Optional<StoryView> existing = storyViewRepository.findByStoryStoryIdAndViewerUserId(storyId, viewerUserId);
        if (existing.isEmpty()) {
            StoryView view = new StoryView();
            view.setStory(story);
            view.setViewer(viewer);
            view.setViewedAt(new Date());
            storyViewRepository.save(view);
            story.setViewsCount((int) storyViewRepository.countByStoryStoryId(storyId));
            storyRepository.save(story);
        }

        Story withGraph = storyRepository.findByIdWithGraph(storyId).orElse(story);
        return toResponse(withGraph, viewerUserId);
    }

    @Override
    @Transactional
    public StoryResponse likeStory(Integer storyId, Integer likerUserId) {
        Story story = loadActiveStory(storyId);
        User liker = userRepository.findById(likerUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (storyLikeRepository.findByStoryStoryIdAndLikerUserId(storyId, likerUserId).isEmpty()) {
            StoryLike like = new StoryLike();
            like.setStory(story);
            like.setLiker(liker);
            like.setLikedAt(new Date());
            storyLikeRepository.save(like);
            story.setLikesCount((int) storyLikeRepository.countByStoryStoryId(storyId));
            storyRepository.save(story);
        }

        Story withGraph = storyRepository.findByIdWithGraph(storyId).orElse(story);
        return toResponse(withGraph, likerUserId);
    }

    @Override
    @Transactional
    public StoryResponse unlikeStory(Integer storyId, Integer likerUserId) {
        Story story = loadActiveStory(storyId);

        storyLikeRepository.findByStoryStoryIdAndLikerUserId(storyId, likerUserId)
                .ifPresent(storyLikeRepository::delete);

        story.setLikesCount((int) storyLikeRepository.countByStoryStoryId(storyId));
        storyRepository.save(story);

        Story withGraph = storyRepository.findByIdWithGraph(storyId).orElse(story);
        return toResponse(withGraph, likerUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoryInteractionUserResponse> getStoryViewers(Integer storyId, Integer ownerUserId) {
        Story story = storyRepository.findByIdWithGraph(storyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Story not found"));
        enforceOwner(story, ownerUserId);

        return storyViewRepository.findByStoryStoryIdOrderByViewedAtDesc(storyId).stream()
                .map(v -> new StoryInteractionUserResponse(
                        v.getViewer().getUserId(),
                        v.getViewer().getUsername(),
                        v.getViewer().getFirstName(),
                        v.getViewer().getLastName(),
                        v.getViewer().getProfileImageUrl(),
                        v.getViewedAt()
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoryInteractionUserResponse> getStoryLikers(Integer storyId, Integer ownerUserId) {
        Story story = storyRepository.findByIdWithGraph(storyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Story not found"));
        enforceOwner(story, ownerUserId);

        return storyLikeRepository.findByStoryStoryIdOrderByLikedAtDesc(storyId).stream()
                .map(v -> new StoryInteractionUserResponse(
                        v.getLiker().getUserId(),
                        v.getLiker().getUsername(),
                        v.getLiker().getFirstName(),
                        v.getLiker().getLastName(),
                        v.getLiker().getProfileImageUrl(),
                        v.getLikedAt()
                ))
                .toList();
    }

    @Override
    @Transactional
    public void deleteStory(Integer storyId, Integer ownerUserId) {
        Story story = storyRepository.findById(storyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Story not found"));
        enforceOwner(story, ownerUserId);
        story.setStatus(StoryStatus.ARCHIVED);
        story.setArchivedAt(new Date());
        storyRepository.save(story);
    }

    @Override
    @Transactional
    public int expireStoriesNow() {
        Date now = new Date();
        List<Story> expired = storyRepository.findByStatusAndExpiresAtBefore(StoryStatus.ACTIVE, now);
        for (Story story : expired) {
            story.setStatus(StoryStatus.EXPIRED);
            if (story.getArchivedAt() == null) {
                story.setArchivedAt(now);
            }
        }
        storyRepository.saveAll(expired);
        return expired.size();
    }

    private Story loadActiveStory(Integer storyId) {
        Story story = storyRepository.findByIdWithGraph(storyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Story not found"));

        if (story.getStatus() != StoryStatus.ACTIVE || story.getExpiresAt() == null || !story.getExpiresAt().after(new Date())) {
            throw new ResponseStatusException(HttpStatus.GONE, "Story is no longer active");
        }
        return story;
    }

    private void enforceOwner(Story story, Integer ownerUserId) {
        if (story.getAuthor() == null || !Objects.equals(story.getAuthor().getUserId(), ownerUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only access your own story insights");
        }
    }

    private StoryVisibility parseVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return StoryVisibility.PUBLIC;
        }
        try {
            return StoryVisibility.valueOf(visibility.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            return StoryVisibility.PUBLIC;
        }
    }

    private MediaType parseMediaType(MultipartFile file, String requestedType) {
        if (requestedType != null && !requestedType.isBlank()) {
            try {
                MediaType mt = MediaType.valueOf(requestedType.trim().toUpperCase(Locale.ROOT));
                if (mt == MediaType.IMAGE || mt == MediaType.VIDEO) {
                    return mt;
                }
            } catch (Exception ignored) {
                // fallback to mime-detection below
            }
        }

        String contentType = file.getContentType();
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            return MediaType.VIDEO;
        }
        return MediaType.IMAGE;
    }

    private String storeStoryFile(MultipartFile file) {
        String originalName = file.getOriginalFilename() == null ? "story" : file.getOriginalFilename();
        String safeOriginal = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        String storedName = UUID.randomUUID() + "_" + safeOriginal;

        Path uploadRoot = Paths.get(uploadDir, "story-media").toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadRoot);
            Path target = uploadRoot.resolve(storedName);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/story-media/" + storedName;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store story media");
        }
    }

    private StoryResponse toResponse(Story story, Integer currentUserIdOrNull) {
        StoryMedia media = null;
        if (story.getMedias() != null && !story.getMedias().isEmpty()) {
            media = story.getMedias().stream()
                    .sorted(Comparator.comparing(sm -> sm.getOrderIndex() == null ? 0 : sm.getOrderIndex()))
                    .findFirst()
                    .orElse(null);
        }

        boolean viewed = false;
        boolean liked = false;
        if (currentUserIdOrNull != null) {
            viewed = storyViewRepository.findByStoryStoryIdAndViewerUserId(story.getStoryId(), currentUserIdOrNull).isPresent();
            liked = storyLikeRepository.findByStoryStoryIdAndLikerUserId(story.getStoryId(), currentUserIdOrNull).isPresent();
        }

        User author = story.getAuthor();
        return new StoryResponse(
                story.getStoryId(),
                author != null ? author.getUserId() : null,
                author != null ? author.getUsername() : null,
                author != null ? author.getFirstName() : null,
                author != null ? author.getLastName() : null,
                author != null ? author.getProfileImageUrl() : null,
                story.getCaption(),
                story.getVisibility() != null ? story.getVisibility().name() : null,
                story.getStatus() != null ? story.getStatus().name() : null,
                story.getViewsCount() == null ? 0 : story.getViewsCount(),
                story.getLikesCount() == null ? 0 : story.getLikesCount(),
                story.getCreatedAt(),
                story.getExpiresAt(),
                story.getArchivedAt(),
                media != null ? media.getFileUrl() : null,
                media != null && media.getMediaType() != null ? media.getMediaType().name() : null,
                viewed,
                liked
        );
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }
}
