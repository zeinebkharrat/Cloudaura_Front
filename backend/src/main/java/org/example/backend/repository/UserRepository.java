package org.example.backend.repository;

import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCaseAndUserIdNot(String email, Integer userId);

    @Query("""
            select u from User u
            where lower(u.username) like lower(concat('%', :term, '%'))
               or lower(u.email) like lower(concat('%', :term, '%'))
               or lower(u.firstName) like lower(concat('%', :term, '%'))
               or lower(u.lastName) like lower(concat('%', :term, '%'))
            """)
    List<User> searchByTerm(@Param("term") String term);
}
