package org.example.backend.dto.shop;

public class ShopCartLineDto {
    private Integer cartItemId;
    private Integer productId;
    private String name;
    private String imageUrl;
    private Double unitPrice;
    private Integer quantity;
    private Double lineTotal;
    /** Stock disponible (pour limiter la quantité côté client). */
    private Integer stock;

    public ShopCartLineDto() {
    }

    public ShopCartLineDto(Integer cartItemId, Integer productId, String name, String imageUrl,
                           Double unitPrice, Integer quantity, Double lineTotal, Integer stock) {
        this.cartItemId = cartItemId;
        this.productId = productId;
        this.name = name;
        this.imageUrl = imageUrl;
        this.unitPrice = unitPrice;
        this.quantity = quantity;
        this.lineTotal = lineTotal;
        this.stock = stock;
    }

    public Integer getCartItemId() {
        return cartItemId;
    }

    public void setCartItemId(Integer cartItemId) {
        this.cartItemId = cartItemId;
    }

    public Integer getProductId() {
        return productId;
    }

    public void setProductId(Integer productId) {
        this.productId = productId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Double getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(Double unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public Double getLineTotal() {
        return lineTotal;
    }

    public void setLineTotal(Double lineTotal) {
        this.lineTotal = lineTotal;
    }

    public Integer getStock() {
        return stock;
    }

    public void setStock(Integer stock) {
        this.stock = stock;
    }
}
