package org.example.backend.repository;

import org.example.backend.model.PostMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostMediaRepository extends JpaRepository<PostMedia, Integer> {
	void deleteByPostPostId(Integer postId);

	@Query("SELECT DISTINCT m FROM PostMedia m "
			+ "JOIN FETCH m.post p "
			+ "LEFT JOIN FETCH p.author "
			+ "LEFT JOIN FETCH p.repostOf")
	List<PostMedia> findAllWithPostGraph();

	@Query("SELECT m FROM PostMedia m "
			+ "JOIN FETCH m.post p "
			+ "JOIN FETCH p.author "
			+ "WHERE m.mediaId = :mediaId")
	Optional<PostMedia> findByIdWithPostAuthor(@Param("mediaId") Integer mediaId);
}

