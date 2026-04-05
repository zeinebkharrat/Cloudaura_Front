package org.example.backend.repository;

import org.example.backend.model.City;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
<<<<<<< HEAD
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
=======
@Repository
// Remplace Long par Integer ici
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
public interface CityRepository extends JpaRepository<City, Integer>, JpaSpecificationExecutor<City> {
    Optional<City> findByName(String name);
}

