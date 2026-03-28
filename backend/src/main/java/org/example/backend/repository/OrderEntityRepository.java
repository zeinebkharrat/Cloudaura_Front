package org.example.backend.repository;

import java.util.List;
import org.example.backend.model.OrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderEntityRepository extends JpaRepository<OrderEntity, Integer> {

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.user")
    List<OrderEntity> findAllWithUser();

    List<OrderEntity> findByUser_UserIdOrderByOrderIdDesc(Integer userId);
}
