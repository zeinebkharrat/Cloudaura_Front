package org.example.backend.repository;

import org.example.backend.model.CookingIngredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CookingIngredientRepository extends JpaRepository<CookingIngredient, Long> {
}
