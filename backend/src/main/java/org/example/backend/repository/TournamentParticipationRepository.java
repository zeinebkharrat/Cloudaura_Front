package org.example.backend.repository;

import org.example.backend.model.TournamentParticipation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TournamentParticipationRepository extends JpaRepository<TournamentParticipation, Integer> {

    Optional<TournamentParticipation> findByTournament_TournamentIdAndUser_UserId(Integer tournamentId, Integer userId);

    List<TournamentParticipation> findByTournament_TournamentIdOrderByTotalScoreDesc(Integer tournamentId);
}
