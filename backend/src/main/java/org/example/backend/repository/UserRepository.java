package org.example.backend.repository;

import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Pageable;
import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    /** En cas de doublons historiques en base, on prend l’utilisateur au plus petit id. */
    Optional<User> findFirstByUsernameIgnoreCaseOrderByUserIdAsc(String username);

    Optional<User> findFirstByEmailIgnoreCaseOrderByUserIdAsc(String email);
    
    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.username) LIKE LOWER(CONCAT('%', :term, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :term, '%')) OR " +
           "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :term, '%')) OR " +
           "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :term, '%'))")
    List<User> searchByTerm(@Param("term") String term);

    boolean existsByEmailIgnoreCaseAndUserIdNot(String email, Integer userId);
    boolean existsByUsernameIgnoreCase(String username);
    boolean existsByEmailIgnoreCase(String email);

    Optional<User> findFirstByUsernameIgnoreCaseOrEmailIgnoreCaseOrderByUserIdAsc(String username, String email);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.city WHERE u.userId = :userId")
    Optional<User> findByIdWithCity(@Param("userId") Integer userId);

    @Query("SELECT u FROM User u ORDER BY COALESCE(u.monthlyScore, 0) DESC, u.userId ASC")
    List<User> findTopByMonthlyScore(Pageable pageable);

    @Modifying
    @Query("UPDATE User u SET u.city = null WHERE u.city.cityId = :cityId")
    int clearCityByCityId(@Param("cityId") Integer cityId);
}
