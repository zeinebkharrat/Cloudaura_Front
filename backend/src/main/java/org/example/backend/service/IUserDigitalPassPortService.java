package org.example.backend.service;

import org.example.backend.dto.PassportPhotoCreateRequest;
import org.example.backend.dto.PassportProfileUpdateRequest;
import org.example.backend.dto.PassportResponse;
import org.example.backend.dto.PassportStampUpsertRequest;

public interface IUserDigitalPassPortService {

    PassportResponse getMyPassport(Integer userId);

    PassportResponse getPassportByUserId(Integer userId);

    PassportResponse updateMyPassportProfile(Integer userId, PassportProfileUpdateRequest request);

    PassportResponse addOrUpdateStamp(Integer userId, PassportStampUpsertRequest request);

    PassportResponse deleteStamp(Integer userId, Integer stampId);

    PassportResponse addPhoto(Integer userId, PassportPhotoCreateRequest request);

    PassportResponse deletePhoto(Integer userId, Integer photoId);
}
