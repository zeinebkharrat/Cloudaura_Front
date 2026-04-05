package org.example.backend.service;

import org.example.backend.model.Crossword;
import org.example.backend.repository.CrosswordRepository;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
public class CrosswordService {

    private final CrosswordRepository crossRepo;

    public CrosswordService(CrosswordRepository crossRepo) {
        this.crossRepo = crossRepo;
    }

    public List<Crossword> findAll() {
        return crossRepo.findAll();
    }

    public Optional<Crossword> findById(Integer id) {
        return crossRepo.findById(id);
    }

    public Crossword create(Crossword c) {
        if (c.getCreatedAt() == null) {
            c.setCreatedAt(new Date());
        }
        return crossRepo.save(c);
    }

    public Optional<Crossword> update(Integer id, Crossword details) {
        return crossRepo
                .findById(id)
                .map(
                        c -> {
                            c.setTitle(details.getTitle());
                            c.setDescription(details.getDescription());
                            c.setPublished(details.getPublished());
                            c.setGridJson(details.getGridJson());
                            return crossRepo.save(c);
                        });
    }

    public boolean delete(Integer id) {
        if (!crossRepo.existsById(id)) {
            return false;
        }
        crossRepo.deleteById(id);
        return true;
    }
}
