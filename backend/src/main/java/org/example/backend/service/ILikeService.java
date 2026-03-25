package org.example.backend.service;

import org.example.backend.model.LikeEntity;

import java.util.List;

public interface ILikeService {
    List<LikeEntity> retrieveAllLikes();
    LikeEntity addLike(LikeEntity like);
    LikeEntity updateLike(LikeEntity like);
    LikeEntity retrieveLike(Integer likeId);
    void removeLike(Integer likeId);
}

