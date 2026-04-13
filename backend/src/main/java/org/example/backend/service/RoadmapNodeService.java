package org.example.backend.service;

import org.example.backend.dto.ludification.RoadmapNodeRequest;
import org.example.backend.i18n.ApiRequestLang;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.RoadmapNode;
import org.example.backend.repository.CrosswordRepository;
import org.example.backend.repository.QuizRepository;
import org.example.backend.repository.RoadmapNodeRepository;
import org.example.backend.repository.UserRoadmapCompletionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RoadmapNodeService {

    private final RoadmapNodeRepository roadRepo;
    private final QuizRepository quizRepo;
    private final CrosswordRepository crossRepo;
    private final UserRoadmapCompletionRepository roadmapCompletionRepo;
    private final TranslationService translationService;

    public RoadmapNodeService(
            RoadmapNodeRepository roadRepo,
            QuizRepository quizRepo,
            CrosswordRepository crossRepo,
            UserRoadmapCompletionRepository roadmapCompletionRepo,
            TranslationService translationService) {
        this.roadRepo = roadRepo;
        this.quizRepo = quizRepo;
        this.crossRepo = crossRepo;
        this.roadmapCompletionRepo = roadmapCompletionRepo;
        this.translationService = translationService;
    }

    @Transactional(readOnly = true)
    public List<RoadmapNode> findAllOrdered() {
        List<RoadmapNode> nodes = roadRepo.findAllByOrderByStepOrderAsc();
        String lang = ApiRequestLang.get();
        for (RoadmapNode n : nodes) {
            String label = n.getNodeLabel();
            if (label == null || label.isBlank()) {
                continue;
            }
            if (CatalogKeyUtil.looksLikeCatalogKey(label)) {
                n.setNodeLabel(null);
            } else {
                n.setNodeLabel(translationService.safeTranslate(label, lang));
            }
        }
        return nodes;
    }

    @Transactional
    public RoadmapNode create(RoadmapNodeRequest req) {
        RoadmapNode r = new RoadmapNode();
        r.setStepOrder(req.stepOrder());
        r.setNodeLabel(req.nodeLabel());
        if (req.quizId() != null) {
            quizRepo.findById(req.quizId()).ifPresent(r::setQuiz);
        }
        if (req.crosswordId() != null) {
            crossRepo.findById(req.crosswordId()).ifPresent(r::setCrossword);
        }
        r.setPuzzleId(req.puzzleId());
        return roadRepo.save(r);
    }

    @Transactional
    public boolean delete(Integer id) {
        if (!roadRepo.existsById(id)) {
            return false;
        }
        // FK from user_roadmap_completions.node_id — must remove completions first
        roadmapCompletionRepo.deleteAllByRoadmapNode_NodeId(id);
        roadRepo.deleteById(id);
        return true;
    }
}
