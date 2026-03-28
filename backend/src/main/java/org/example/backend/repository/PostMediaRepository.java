package org.example.backend.repository;

import org.example.backend.model.PostMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PostMediaRepository extends JpaRepository<PostMedia, Integer> {
}

