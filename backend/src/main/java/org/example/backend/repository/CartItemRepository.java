package org.example.backend.repository;

import java.util.List;
import java.util.Optional;
import org.example.backend.model.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CartItemRepository extends JpaRepository<CartItem, Integer> {
    Optional<CartItem> findByCart_CartIdAndProduct_ProductId(Integer cartId, Integer productId);

    @Query("SELECT ci FROM CartItem ci JOIN FETCH ci.product WHERE ci.cart.cartId = :cartId")
    List<CartItem> findByCartIdWithProduct(@Param("cartId") Integer cartId);
}
