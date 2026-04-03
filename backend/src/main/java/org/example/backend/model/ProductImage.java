package org.example.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "product_images")
public class ProductImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("id")
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    // Accept "url" OR "imageUrl" from JSON — the frontend sends "url"
    @JsonProperty("imageUrl")
    private String imageUrl;

    // Alias for deserialization so {"url":"..."} also sets imageUrl
    @JsonProperty("url")
    public void setUrl(String url) {
        if (url != null && !url.isBlank()) {
            this.imageUrl = url;
        }
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
}
