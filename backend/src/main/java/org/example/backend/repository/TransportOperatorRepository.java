package org.example.backend.repository;

import org.example.backend.model.TransportOperator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TransportOperatorRepository extends JpaRepository<TransportOperator, Integer> {
}
