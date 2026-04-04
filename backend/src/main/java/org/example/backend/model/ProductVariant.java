package org.example.backend.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "product_variants")
public class ProductVariant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer variantId;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    private String size;    // Ex: S, M, L, XL
    private String color;   // Ex: Rouge, Beige
    private Integer stock;  // Stock spécifique à cette variante
    private Double priceOverride; // Prix optionnel si différent du base price

    public Integer getVariantId() { return variantId; }
    public void setVariantId(Integer variantId) { this.variantId = variantId; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public String getSize() { return size; }
    public void setSize(String size) { this.size = size; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Integer getStock() { return stock; }
    public void setStock(Integer stock) { this.stock = stock; }
    public Double getPriceOverride() { return priceOverride; }
    public void setPriceOverride(Double priceOverride) { this.priceOverride = priceOverride; }
}
