package org.example.backend.service;

import org.example.backend.model.PostMedia;

import java.util.List;

public interface IPostMediaService {
    List<PostMedia> retrieveAllMedia();
    PostMedia addMedia(PostMedia media);
    PostMedia updateMedia(PostMedia media);
    PostMedia retrieveMedia(Integer mediaId);
    void removeMedia(Integer mediaId);
}

