package org.example.backend.repository;

import org.example.backend.model.Tournament;
import org.example.backend.model.TournamentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface TournamentRepository extends JpaRepository<Tournament, Integer> {

    @Query(
            "select t from Tournament t where t.status = :st and t.startsAt <= :now and t.endsAt >= :now")
    List<Tournament> findLiveAt(@Param("st") TournamentStatus st, @Param("now") Date now);
}
