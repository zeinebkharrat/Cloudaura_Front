package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.PageResponse;
import org.example.backend.model.Post;
import org.example.backend.service.PostService;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/posts")
@RequiredArgsConstructor
public class AdminPostController {

    private final PostService postService;

    @GetMapping
    public PageResponse<AdminPostDto> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);

        String[] sortParts = sort.split(",");
        String sortBy = sortParts[0].trim();
        Sort.Direction direction = (sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1].trim()))
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;

        List<Post> filtered = postService.retrievePosts().stream()
                .filter(p -> userId == null || (p.getAuthor() != null && userId.equals(p.getAuthor().getUserId())))
                .filter(p -> matchesQuery(p, q))
                .filter(p -> matchesTag(p, tag))
                .sorted(buildComparator(sortBy, direction))
                .collect(Collectors.toList());

        int fromIndex = Math.min(safePage * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        List<AdminPostDto> content = filtered.subList(fromIndex, toIndex).stream()
                .map(this::toDto)
                .collect(Collectors.toList());

        PageImpl<AdminPostDto> pageData = new PageImpl<>(
                content,
                PageRequest.of(safePage, safeSize, Sort.by(direction, sortBy)),
                filtered.size()
        );

        return PageResponse.from(pageData);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        postService.removePost(id);
        return ResponseEntity.noContent().build();
    }

    private Comparator<Post> buildComparator(String sortBy, Sort.Direction direction) {
        Comparator<Post> comparator;
        switch (sortBy) {
            case "likesCount" -> comparator = Comparator.comparingInt(p -> p.getLikesCount() == null ? 0 : p.getLikesCount());
            case "commentsCount" -> comparator = Comparator.comparingInt(p -> p.getCommentsCount() == null ? 0 : p.getCommentsCount());
            case "totalViews" -> comparator = Comparator.comparingInt(p -> p.getTotalViews() == null ? 0 : p.getTotalViews());
            case "postScore" -> comparator = Comparator.comparingDouble(p -> p.getPostScore() == null ? 0.0 : p.getPostScore());
            case "author" -> comparator = Comparator.comparing(this::authorName, String.CASE_INSENSITIVE_ORDER);
            case "postId" -> comparator = Comparator.comparingInt(p -> p.getPostId() == null ? 0 : p.getPostId());
            case "createdAt" -> comparator = Comparator.comparing(this::createdAtOrEpoch);
            default -> comparator = Comparator.comparing(this::createdAtOrEpoch);
        }

        return direction == Sort.Direction.DESC ? comparator.reversed() : comparator;
    }

    private boolean matchesQuery(Post post, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }

        String needle = query.toLowerCase(Locale.ROOT).trim();
        return containsIgnoreCase(post.getContent(), needle)
                || containsIgnoreCase(post.getHashtags(), needle)
                || containsIgnoreCase(authorName(post), needle)
                || containsIgnoreCase(post.getLocation(), needle);
    }

    private boolean matchesTag(Post post, String tag) {
        if (tag == null || tag.isBlank()) {
            return true;
        }

        String normalized = tag.trim().toLowerCase(Locale.ROOT);
        if (!normalized.startsWith("#")) {
            normalized = "#" + normalized;
        }

        return containsIgnoreCase(post.getHashtags(), normalized)
                || containsIgnoreCase(post.getContent(), normalized);
    }

    private boolean containsIgnoreCase(String source, String needleLowerCase) {
        if (source == null || source.isBlank()) {
            return false;
        }
        return source.toLowerCase(Locale.ROOT).contains(needleLowerCase);
    }

    private String authorName(Post post) {
        if (post.getAuthor() == null) {
            return "";
        }
        String username = post.getAuthor().getUsername();
        if (username != null && !username.isBlank()) {
            return username;
        }
        String firstName = post.getAuthor().getFirstName();
        String lastName = post.getAuthor().getLastName();
        return ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
    }

    private Date createdAtOrEpoch(Post post) {
        return post.getCreatedAt() == null ? new Date(0) : post.getCreatedAt();
    }

    private AdminPostDto toDto(Post post) {
        return new AdminPostDto(
                post.getPostId(),
                post.getAuthor() != null ? post.getAuthor().getUserId() : null,
                authorName(post),
                post.getContent(),
                post.getHashtags(),
                post.getLocation(),
                post.getVisibility(),
                post.getLikesCount() == null ? 0 : post.getLikesCount(),
                post.getCommentsCount() == null ? 0 : post.getCommentsCount(),
                post.getTotalViews() == null ? 0 : post.getTotalViews(),
                post.getPostScore() == null ? 0.0 : post.getPostScore(),
                post.getCreatedAt(),
                post.getRepostOf() != null ? post.getRepostOf().getPostId() : null
        );
    }

    public record AdminPostDto(
            Integer postId,
            Integer authorId,
            String authorUsername,
            String content,
            String hashtags,
            String location,
            String visibility,
            Integer likesCount,
            Integer commentsCount,
            Integer totalViews,
            Double postScore,
            Date createdAt,
            Integer repostOfPostId
    ) {
    }
}
