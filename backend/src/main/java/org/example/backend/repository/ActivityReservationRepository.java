package org.example.backend.repository;

import org.example.backend.model.ActivityReservation;
import org.example.backend.model.ReservationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Date;
import java.util.List;
import java.util.Optional;

public interface ActivityReservationRepository extends JpaRepository<ActivityReservation, Integer>, JpaSpecificationExecutor<ActivityReservation> {

	@Query("""
		select coalesce(sum(ar.numberOfPeople), 0)
		from ActivityReservation ar
		where ar.activity.activityId = :activityId
		  and ar.reservationDate >= :startInclusive
		  and ar.reservationDate < :endExclusive
		  and ar.status in :statuses
		""")
	Integer sumPeopleForActivityAndDate(
		@Param("activityId") Integer activityId,
		@Param("startInclusive") Date startInclusive,
		@Param("endExclusive") Date endExclusive,
		@Param("statuses") List<ReservationStatus> statuses
	);

	Page<ActivityReservation> findByUserUserIdOrderByReservationDateDesc(Integer userId, Pageable pageable);

	@Query("""
		select ar
		from ActivityReservation ar
		join fetch ar.activity a
		join fetch a.city
		left join fetch ar.user
		where ar.activityReservationId = :reservationId
		""")
	Optional<ActivityReservation> findByIdWithAssociations(@Param("reservationId") Integer reservationId);
}
