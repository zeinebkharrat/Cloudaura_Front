package org.example.backend.service;

import org.example.backend.dto.StoryInteractionUserResponse;
import org.example.backend.dto.StoryResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface IStoryService {
    StoryResponse createStory(Integer authorUserId, MultipartFile file, String caption, String visibility, String mediaType);
    List<StoryResponse> getFeedStories(Integer currentUserIdOrNull);
    List<StoryResponse> getMyStories(Integer userId);
    List<StoryResponse> getMyArchive(Integer userId);
    StoryResponse markViewed(Integer storyId, Integer viewerUserId);
    StoryResponse likeStory(Integer storyId, Integer likerUserId);
    StoryResponse unlikeStory(Integer storyId, Integer likerUserId);
    List<StoryInteractionUserResponse> getStoryViewers(Integer storyId, Integer ownerUserId);
    List<StoryInteractionUserResponse> getStoryLikers(Integer storyId, Integer ownerUserId);
    void deleteStory(Integer storyId, Integer ownerUserId);
    int expireStoriesNow();
}
