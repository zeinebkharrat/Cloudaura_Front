package org.example.backend.repository;

import org.example.backend.model.TransportQuoteRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransportQuoteRequestRepository extends JpaRepository<TransportQuoteRequest, Long> {

    List<TransportQuoteRequest> findTop50ByUserIdOrderByCreatedAtDesc(Integer userId);
}
