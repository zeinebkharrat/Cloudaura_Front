package com.yallatn.repository.accommodation;

import com.yallatn.model.accommodation.Accommodation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AccommodationRepository extends JpaRepository<Accommodation, Integer> {
    List<Accommodation> findByCity_CityId(int cityId);

    List<Accommodation> findByTypeAndCity_CityId(Accommodation.AccommodationType type, int cityId);

    List<Accommodation> findByPricePerNightBetween(double min, double max);

    List<Accommodation> findByRatingGreaterThanEqual(double rating);

    @Query("SELECT a FROM Accommodation a WHERE a.city.cityId = :cityId " +
           "AND a.status = com.yallatn.model.accommodation.Accommodation.AccommodationStatus.AVAILABLE " +
           "AND (:type IS NULL OR a.type = :type) " +
           "AND (:minPrice IS NULL OR a.pricePerNight >= :minPrice) " +
           "AND (:maxPrice IS NULL OR a.pricePerNight <= :maxPrice) " +
           "ORDER BY a.rating DESC")
    List<Accommodation> searchAccommodations(
            @Param("cityId") int cityId,
            @Param("type") Accommodation.AccommodationType type,
            @Param("minPrice") Double minPrice,
            @Param("maxPrice") Double maxPrice);
}
