package org.example.backend.service;

import org.example.backend.model.LikeEntity;
import org.example.backend.repository.LikeEntityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class LikeService implements ILikeService {

    @Autowired
    LikeEntityRepository likeRepo;

    @Override
    public List<LikeEntity> retrieveAllLikes() {
        return likeRepo.findAll();
    }

    @Override
    public LikeEntity addLike(LikeEntity like) {
        return likeRepo.save(like);
    }

    @Override
    public LikeEntity updateLike(LikeEntity like) {
        return likeRepo.save(like);
    }

    @Override
    public LikeEntity retrieveLike(Integer likeId) {
        return likeRepo.findById(likeId).orElse(null);
    }

    @Override
    public void removeLike(Integer likeId) {
        likeRepo.deleteById(likeId);
    }
}
