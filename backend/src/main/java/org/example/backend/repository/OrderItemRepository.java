package org.example.backend.repository;

import java.util.List;
import org.example.backend.model.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Integer> {
    long countByOrder_OrderId(Integer orderId);

    long countByVariant_VariantId(Integer variantId);

    void deleteByOrder_OrderId(Integer orderId);

    void deleteAllByProduct_ProductId(Integer productId);

    @Query(
            "SELECT oi FROM OrderItem oi JOIN FETCH oi.product LEFT JOIN FETCH oi.variant "
                    + "WHERE oi.order.orderId = :orderId")
    List<OrderItem> findByOrderIdWithProduct(@Param("orderId") Integer orderId);

    @Query(
        "SELECT DISTINCT oi FROM OrderItem oi "
            + "LEFT JOIN FETCH oi.product p "
            + "LEFT JOIN FETCH p.user "
            + "LEFT JOIN FETCH oi.variant "
            + "LEFT JOIN FETCH oi.order ord "
            + "LEFT JOIN FETCH ord.user"
    )
    List<OrderItem> findAllWithDetails();

    @Query(
        "SELECT oi FROM OrderItem oi "
            + "JOIN FETCH oi.product p "
            + "JOIN FETCH oi.order o "
            + "WHERE LOWER(p.user.username) = LOWER(:username) "
            + "ORDER BY o.orderId DESC"
    )
    List<OrderItem> findByArtisanUsername(@Param("username") String username);
}
