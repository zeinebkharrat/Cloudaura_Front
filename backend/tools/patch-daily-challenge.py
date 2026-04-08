from pathlib import Path

# DailyChallenge.java
p = Path(r"src/main/java/org/example/backend/model/DailyChallenge.java")
t = p.read_text(encoding="utf-8")
t = t.replace(
    "@Temporal(TemporalType.DATE)\n    private Date validFrom",
    "@Temporal(TemporalType.TIMESTAMP)\n    private Date validFrom",
)
t = t.replace(
    "@Temporal(TemporalType.DATE)\n    private Date validTo",
    "@Temporal(TemporalType.TIMESTAMP)\n    private Date validTo",
)
p.write_text(t, encoding="utf-8", newline="\n")
print("DailyChallenge model OK")

p = Path(r"src/main/java/org/example/backend/repository/DailyChallengeRepository.java")
t = p.read_text(encoding="utf-8")
t = t.replace(
    "c.validFrom <= :day and c.validTo >= :day",
    "c.validFrom <= :now and c.validTo >= :now",
)
t = t.replace(
    'findActiveOnDay(@Param("day") Date day)',
    'findActiveAt(@Param("now") Date now)',
)
p.write_text(t, encoding="utf-8", newline="\n")
print("Repository OK")

p = Path(r"src/main/java/org/example/backend/dto/gamification/DailyChallengeRequest.java")
t = p.read_text(encoding="utf-8")
old = """import org.example.backend.model.LudificationGameKind;

import java.util.Date;

public record DailyChallengeRequest(
        String title,
        String description,
        Integer pointsReward,
        Date validFrom,
        Date validTo,
        LudificationGameKind gameKind,
        Integer targetId,
        Boolean active) {}"""
new = """import org.example.backend.model.LudificationGameKind;

public record DailyChallengeRequest(
        String title,
        String description,
        Integer pointsReward,
        LudificationGameKind gameKind,
        Integer targetId,
        Boolean active) {}"""
if old not in t:
    raise SystemExit("DailyChallengeRequest pattern mismatch:\n" + t)
p.write_text(t.replace(old, new), encoding="utf-8", newline="\n")
print("DTO OK")
