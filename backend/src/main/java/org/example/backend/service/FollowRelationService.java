package org.example.backend.service;

import org.example.backend.model.FollowRelation;
import org.example.backend.model.User;
import org.example.backend.repository.FollowRelationRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
public class FollowRelationService {

    private final FollowRelationRepository followRepo;
    private final UserRepository userRepo;

    public FollowRelationService(FollowRelationRepository followRepo, UserRepository userRepo) {
        this.followRepo = followRepo;
        this.userRepo = userRepo;
    }

    @Transactional
    public Map<String, Object> toggleFollow(Integer followerId, Integer followedId) {
        if (followerId.equals(followedId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot follow yourself");
        }

        User follower = userRepo.findById(followerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Follower user not found"));
        User followed = userRepo.findById(followedId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user not found"));

        return followRepo.findByFollowerUserIdAndFollowedUserId(followerId, followedId)
                .map(existing -> {
                    followRepo.delete(existing);
                return Map.<String, Object>of(
                            "following", false,
                            "followersCount", followRepo.countByFollowedUserId(followedId),
                            "followingCount", followRepo.countByFollowerUserId(followerId)
                    );
                })
                .orElseGet(() -> {
                    FollowRelation relation = new FollowRelation();
                    relation.setFollower(follower);
                    relation.setFollowed(followed);
                    relation.setCreatedAt(new Date());
                    followRepo.save(relation);
                return Map.<String, Object>of(
                            "following", true,
                            "followersCount", followRepo.countByFollowedUserId(followedId),
                            "followingCount", followRepo.countByFollowerUserId(followerId)
                    );
                });
    }

    public boolean isFollowing(Integer followerId, Integer followedId) {
        return followRepo.existsByFollowerUserIdAndFollowedUserId(followerId, followedId);
    }

    public List<FollowRelation> followersOf(Integer userId) {
        return followRepo.findByFollowedUserId(userId);
    }

    public List<FollowRelation> followingOf(Integer userId) {
        return followRepo.findByFollowerUserId(userId);
    }
}
