package org.example.backend.repository;

import org.example.backend.model.KaraokeSong;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KaraokeSongRepository extends JpaRepository<KaraokeSong, Long> {
    List<KaraokeSong> findByPublishedTrue();
}
