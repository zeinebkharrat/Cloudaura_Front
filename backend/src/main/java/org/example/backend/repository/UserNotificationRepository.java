package org.example.backend.repository;

import org.example.backend.model.UserNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserNotificationRepository extends JpaRepository<UserNotification, Integer> {

    List<UserNotification> findByUserUserIdOrderByCreatedAtDesc(Integer userId);

    long countByUserUserIdAndReadFlagFalse(Integer userId);

    Optional<UserNotification> findByNotificationIdAndUserUserId(Integer notificationId, Integer userId);

        Optional<UserNotification> findFirstByUserUserIdAndTypeAndReservationTypeAndReservationIdOrderByCreatedAtDesc(
            Integer userId,
            String type,
            String reservationType,
            Integer reservationId
        );

    @Modifying
    @Query("update UserNotification n set n.readFlag = true where n.user.userId = :userId and n.readFlag = false")
    int markAllAsReadForUser(@Param("userId") Integer userId);
}
