package org.example.backend.service;

import org.example.backend.model.PostMedia;
import org.example.backend.repository.PostMediaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PostMediaService implements IPostMediaService {

    @Autowired
    PostMediaRepository postMediaRepo;

    @Override
    @Transactional(readOnly = true)
    public List<PostMedia> retrieveAllMedia() {
        return postMediaRepo.findAllWithPostGraph();
    }

    @Override
    public PostMedia addMedia(PostMedia media) {
        return postMediaRepo.save(media);
    }

    @Override
    public PostMedia updateMedia(PostMedia media) {
        return postMediaRepo.save(media);
    }

    @Override
    public PostMedia retrieveMedia(Integer mediaId) {
        return postMediaRepo.findById(mediaId).orElse(null);
    }

    @Override
    public void removeMedia(Integer mediaId) {
        postMediaRepo.deleteById(mediaId);
    }
}
