package org.example.backend.service;

import org.example.backend.model.LudoCard;
import org.example.backend.repository.LudoCardRepository;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Service
public class LudoCardService {

    private final LudoCardRepository ludoCardRepo;

    public LudoCardService(LudoCardRepository ludoCardRepo) {
        this.ludoCardRepo = ludoCardRepo;
    }

    public List<LudoCard> findAll() {
        return ludoCardRepo.findAll();
    }

    public LudoCard create(LudoCard card) {
        if (card.getCreatedAt() == null) {
            card.setCreatedAt(new Date());
        }
        if (card.getPublished() == null) {
            card.setPublished(Boolean.TRUE);
        }
        if (card.getEffectSteps() == null) {
            card.setEffectSteps(0);
        }
        return ludoCardRepo.save(card);
    }

    public boolean delete(Integer id) {
        if (!ludoCardRepo.existsById(id)) {
            return false;
        }
        ludoCardRepo.deleteById(id);
        return true;
    }
}
