package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.PageResponse;
import org.example.backend.dto.publicapi.CreatePublicReviewRequest;
import org.example.backend.dto.publicapi.PublicReviewPageResponse;
import org.example.backend.dto.publicapi.PublicReviewResponse;
import org.example.backend.dto.publicapi.ReviewSummaryResponse;
import org.example.backend.model.Activity;
import org.example.backend.model.ActivityReview;
import org.example.backend.model.Restaurant;
import org.example.backend.model.RestaurantReview;
import org.example.backend.model.User;
import org.example.backend.repository.ActivityReviewRepository;
import org.example.backend.repository.RestaurantReviewRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class PublicReviewService {

    private final RestaurantService restaurantService;
    private final ActivityService activityService;
    private final RestaurantReviewRepository restaurantReviewRepository;
    private final ActivityReviewRepository activityReviewRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PublicReviewPageResponse listRestaurantReviews(Integer restaurantId, Pageable pageable) {
        restaurantService.findRestaurant(restaurantId);
        Page<PublicReviewResponse> page = restaurantReviewRepository
            .findByRestaurantRestaurantId(restaurantId, pageable)
            .map(this::toResponse);
        return new PublicReviewPageResponse(summaryForRestaurant(restaurantId), PageResponse.from(page));
    }

    @Transactional(readOnly = true)
    public PublicReviewPageResponse listActivityReviews(Integer activityId, Pageable pageable) {
        activityService.findActivity(activityId);
        Page<PublicReviewResponse> page = activityReviewRepository
            .findByActivityActivityId(activityId, pageable)
            .map(this::toResponse);
        return new PublicReviewPageResponse(summaryForActivity(activityId), PageResponse.from(page));
    }

    @Transactional(readOnly = true)
    public ReviewSummaryResponse summaryForRestaurant(Integer restaurantId) {
        Double average = restaurantReviewRepository.averageStarsByRestaurantId(restaurantId);
        long total = restaurantReviewRepository.countByRestaurantRestaurantId(restaurantId);
        return new ReviewSummaryResponse(average != null ? average : 0.0, total);
    }

    @Transactional(readOnly = true)
    public ReviewSummaryResponse summaryForActivity(Integer activityId) {
        Double average = activityReviewRepository.averageStarsByActivityId(activityId);
        long total = activityReviewRepository.countByActivityActivityId(activityId);
        return new ReviewSummaryResponse(average != null ? average : 0.0, total);
    }

    @Transactional
    public PublicReviewResponse upsertRestaurantReview(Integer restaurantId, CreatePublicReviewRequest request) {
        Restaurant restaurant = restaurantService.findRestaurant(restaurantId);
        User user = currentAuthenticatedUser();

        RestaurantReview review = restaurantReviewRepository
            .findByRestaurantRestaurantIdAndUserUserId(restaurantId, user.getUserId())
            .orElseGet(RestaurantReview::new);

        review.setRestaurant(restaurant);
        review.setUser(user);
        review.setStars(request.stars());
        review.setCommentText(request.commentText().trim());

        return toResponse(restaurantReviewRepository.save(review));
    }

    @Transactional
    public PublicReviewResponse upsertActivityReview(Integer activityId, CreatePublicReviewRequest request) {
        Activity activity = activityService.findActivity(activityId);
        User user = currentAuthenticatedUser();

        ActivityReview review = activityReviewRepository
            .findByActivityActivityIdAndUserUserId(activityId, user.getUserId())
            .orElseGet(ActivityReview::new);

        review.setActivity(activity);
        review.setUser(user);
        review.setStars(request.stars());
        review.setCommentText(request.commentText().trim());

        return toResponse(activityReviewRepository.save(review));
    }

    @Transactional
    public void deleteRestaurantReview(Integer restaurantId) {
        restaurantService.findRestaurant(restaurantId);
        User user = currentAuthenticatedUser();

        RestaurantReview review = restaurantReviewRepository
            .findByRestaurantRestaurantIdAndUserUserId(restaurantId, user.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Avis introuvable"));

        restaurantReviewRepository.delete(review);
    }

    @Transactional
    public void deleteActivityReview(Integer activityId) {
        activityService.findActivity(activityId);
        User user = currentAuthenticatedUser();

        ActivityReview review = activityReviewRepository
            .findByActivityActivityIdAndUserUserId(activityId, user.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Avis introuvable"));

        activityReviewRepository.delete(review);
    }

    private PublicReviewResponse toResponse(RestaurantReview review) {
        return new PublicReviewResponse(
            review.getReviewId(),
            review.getUser().getUserId(),
            review.getUser().getUsername(),
            review.getUser().getEmail(),
            review.getUser().getProfileImageUrl(),
            review.getStars(),
            review.getCommentText(),
            review.getCreatedAt()
        );
    }

    private PublicReviewResponse toResponse(ActivityReview review) {
        return new PublicReviewResponse(
            review.getReviewId(),
            review.getUser().getUserId(),
            review.getUser().getUsername(),
            review.getUser().getEmail(),
            review.getUser().getProfileImageUrl(),
            review.getStars(),
            review.getCommentText(),
            review.getCreatedAt()
        );
    }

    private User currentAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentification requise");
        }

        String username = authentication.getName();
        return userRepository.findFirstByUsernameIgnoreCaseOrEmailIgnoreCaseOrderByUserIdAsc(username, username)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur authentifié introuvable"));
    }
}
