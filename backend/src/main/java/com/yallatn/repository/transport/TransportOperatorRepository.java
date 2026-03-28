package com.yallatn.repository.transport;

import com.yallatn.model.transport.TransportOperator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TransportOperatorRepository extends JpaRepository<TransportOperator, Integer> {
}
