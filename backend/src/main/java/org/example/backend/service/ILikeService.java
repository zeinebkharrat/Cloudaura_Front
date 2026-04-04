package org.example.backend.service;

import org.example.backend.model.LikeEntity;

import java.util.List;
import java.util.Map;

public interface ILikeService {
    List<LikeEntity> retrieveAllLikes();
    LikeEntity addLike(LikeEntity like);
    LikeEntity updateLike(LikeEntity like);
    LikeEntity retrieveLike(Integer likeId);
    void removeLike(Integer likeId);
    
    // New JWT-authenticated methods
    LikeEntity toggleLike(Integer postId, Integer userId);
    boolean isPostLikedByUser(Integer postId, Integer userId);
    List<LikeEntity> getLikesByPost(Integer postId);

    /**
     * Fully loads likes + nicknames inside a transaction (safe with open-in-view=false).
     */
    Map<String, Object> getLikesByPostApiPayload(Integer postId, Integer currentUserIdOrNull);

    void unlikePost(Integer postId, Integer userId);
}

