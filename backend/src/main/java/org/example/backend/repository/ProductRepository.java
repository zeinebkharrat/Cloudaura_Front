package org.example.backend.repository;

import java.util.List;
import java.util.Optional;
import org.example.backend.model.Product;
import org.example.backend.model.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository extends JpaRepository<Product, Integer> {

    @Query("SELECT DISTINCT p FROM Product p LEFT JOIN FETCH p.user WHERE p.status IN ('PUBLISHED', 'PENDING')")
    List<Product> findAllPublished();

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.user WHERE p.status IN ('PUBLISHED', 'PENDING') AND p.category = :category")
    List<Product> findPublishedByCategory(@Param("category") ProductCategory category);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.user WHERE p.productId = :id")
    Optional<Product> findByIdWithSeller(@Param("id") Integer id);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.user WHERE LOWER(p.user.username) = LOWER(:username)")
    List<Product> findAllByArtisan(@Param("username") String username);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.user WHERE p.status IN ('PUBLISHED', 'PENDING') AND p.user.city.cityId = :cityId")
    List<Product> findPublishedByCity(@Param("cityId") Integer cityId);
}

