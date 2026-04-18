package org.example.backend.service;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import org.example.backend.i18n.ApiRequestLang;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.Crossword;
import org.example.backend.repository.CrosswordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CrosswordService {

    private final CrosswordRepository crossRepo;
    private final TranslationService translationService;

    public CrosswordService(CrosswordRepository crossRepo, TranslationService translationService) {
        this.crossRepo = crossRepo;
        this.translationService = translationService;
    }

    @Transactional(readOnly = true)
    public List<Crossword> findAll() {
        String lang = ApiRequestLang.get();
        List<Crossword> list = crossRepo.findAll();
        for (Crossword c : list) {
            applyCrosswordTranslation(c, lang);
        }
        return list;
    }

    @Transactional(readOnly = true)
    public Optional<Crossword> findById(Integer id) {
        String lang = ApiRequestLang.get();
        return crossRepo.findById(id).map(c -> {
            applyCrosswordTranslation(c, lang);
            return c;
        });
    }

    private void applyCrosswordTranslation(Crossword c, String lang) {
        String title = c.getTitle();
        if (CatalogKeyUtil.looksLikeCatalogKey(title)) {
            c.setTitle(null);
        } else if (title != null) {
            c.setTitle(translationService.safeTranslate(title, lang));
        }
        String desc = c.getDescription();
        if (CatalogKeyUtil.looksLikeCatalogKey(desc)) {
            c.setDescription(null);
        } else if (desc != null) {
            c.setDescription(translationService.safeTranslate(desc, lang));
        }
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
