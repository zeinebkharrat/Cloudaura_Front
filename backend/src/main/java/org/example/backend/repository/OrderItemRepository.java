package org.example.backend.repository;

import java.util.List;
import org.example.backend.model.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Integer> {
    @Query("SELECT oi FROM OrderItem oi JOIN FETCH oi.product WHERE oi.order.orderId = :orderId")
    List<OrderItem> findByOrderIdWithProduct(@Param("orderId") Integer orderId);

    @Query(
        "SELECT DISTINCT oi FROM OrderItem oi "
            + "LEFT JOIN FETCH oi.product "
            + "LEFT JOIN FETCH oi.order ord "
            + "LEFT JOIN FETCH ord.user"
    )
    List<OrderItem> findAllWithDetails();
}
