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
    void deleteAllByProduct_ProductId(Integer productId);

    Optional<CartItem> findByCart_CartIdAndProduct_ProductId(Integer cartId, Integer productId);

    @Query("SELECT ci FROM CartItem ci JOIN FETCH ci.product WHERE ci.cart.cartId = :cartId")
    List<CartItem> findByCartIdWithProduct(@Param("cartId") Integer cartId);

    @Query("SELECT SUM(ci.quantity) FROM CartItem ci WHERE ci.product.productId = :productId AND ci.variant IS NULL AND ci.reservedUntil > CURRENT_TIMESTAMP AND ci.cart.cartId <> :excludeCartId")
    Integer sumReservedQuantityForProduct(@Param("productId") Integer productId, @Param("excludeCartId") Integer excludeCartId);

    @Query("SELECT SUM(ci.quantity) FROM CartItem ci WHERE ci.variant.variantId = :variantId AND ci.reservedUntil > CURRENT_TIMESTAMP AND ci.cart.cartId <> :excludeCartId")
    Integer sumReservedQuantityForVariant(@Param("variantId") Integer variantId, @Param("excludeCartId") Integer excludeCartId);
}
