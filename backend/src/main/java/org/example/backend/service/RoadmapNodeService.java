package org.example.backend.service;

import org.example.backend.dto.ludification.RoadmapNodeRequest;
import org.example.backend.model.RoadmapNode;
import org.example.backend.repository.CrosswordRepository;
import org.example.backend.repository.QuizRepository;
import org.example.backend.repository.RoadmapNodeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RoadmapNodeService {

    private final RoadmapNodeRepository roadRepo;
    private final QuizRepository quizRepo;
    private final CrosswordRepository crossRepo;

    public RoadmapNodeService(
            RoadmapNodeRepository roadRepo,
            QuizRepository quizRepo,
            CrosswordRepository crossRepo) {
        this.roadRepo = roadRepo;
        this.quizRepo = quizRepo;
        this.crossRepo = crossRepo;
    }

    public List<RoadmapNode> findAllOrdered() {
        return roadRepo.findAllByOrderByStepOrderAsc();
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

    public boolean delete(Integer id) {
        if (!roadRepo.existsById(id)) {
            return false;
        }
        roadRepo.deleteById(id);
        return true;
    }
}
