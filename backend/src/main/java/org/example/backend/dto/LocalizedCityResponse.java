package org.example.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.example.backend.i18n.LanguageUtil;
import org.example.backend.model.City;
import org.example.backend.service.CatalogTranslationService;

/**
 * Public city payload with catalog-localized text fields (same wire shape as {@link City} + ferry alias).
 */
public record LocalizedCityResponse(
        Integer cityId,
        String name,
        String region,
        String description,
        Double latitude,
        Double longitude,
        Boolean hasAirport,
        Boolean hasBusStation,
        Boolean hasTrainStation,
        Boolean hasPort,
        @JsonProperty("hasFerryPort") Boolean hasFerryPort
) {
    public static LocalizedCityResponse from(City c, String lang, CatalogTranslationService catalog) {
        String l = LanguageUtil.normalize(lang);
        int id = c.getCityId();
        Boolean port = c.getHasPort();
        return new LocalizedCityResponse(
                id,
                catalog.resolve("city." + id + ".name", l, c.getName()),
                catalog.resolve("city." + id + ".region", l, c.getRegion()),
                catalog.resolve("city." + id + ".description", l, c.getDescription()),
                c.getLatitude(),
                c.getLongitude(),
                c.getHasAirport(),
                c.getHasBusStation(),
                c.getHasTrainStation(),
                port,
                port
        );
    }
}
