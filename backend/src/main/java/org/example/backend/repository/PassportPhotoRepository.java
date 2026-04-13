package org.example.backend.repository;

import org.example.backend.model.PassportPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PassportPhotoRepository extends JpaRepository<PassportPhoto, Integer> {

    @Query("SELECT p FROM PassportPhoto p "
            + "LEFT JOIN FETCH p.city c "
            + "WHERE p.passport.passportId = :passportId "
            + "ORDER BY p.uploadedAt DESC")
    List<PassportPhoto> findByPassportIdWithCity(@Param("passportId") Integer passportId);
}
