from pathlib import Path

p = Path(r"src/main/java/org/example/backend/controller/GamificationAdminController.java")
raw = p.read_bytes()
if b"\x00" in raw[:80]:
    t = raw.decode("utf-16-le")
    p.write_text(t, encoding="utf-8", newline="\n")
t = p.read_text(encoding="utf-8")

old_imports = """import java.util.Comparator;
import java.util.List;
import java.util.Map;"""
new_imports = """import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Map;"""
if old_imports not in t:
    raise SystemExit("import block mismatch")
t = t.replace(old_imports, new_imports)

old_post = """    @PostMapping("/daily-challenges")
    public DailyChallenge createChallenge(@RequestBody DailyChallengeRequest req) {
        DailyChallenge c = new DailyChallenge();
        applyChallenge(c, req);
        return dailyChallengeRepository.save(c);
    }"""
new_post = """    @PostMapping("/daily-challenges")
    public DailyChallenge createChallenge(@RequestBody DailyChallengeRequest req) {
        DailyChallenge c = new DailyChallenge();
        applyChallenge(c, req);
        if (c.getGameKind() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "gameKind required");
        }
        Date now = new Date();
        c.setValidFrom(now);
        c.setValidTo(Date.from(now.toInstant().plus(24, ChronoUnit.HOURS)));
        return dailyChallengeRepository.save(c);
    }"""
if old_post not in t:
    raise SystemExit("createChallenge block mismatch")
t = t.replace(old_post, new_post)

old_apply = """        if (req.pointsReward() != null) {
            c.setPointsReward(req.pointsReward());
        }
        if (req.validFrom() != null) {
            c.setValidFrom(req.validFrom());
        }
        if (req.validTo() != null) {
            c.setValidTo(req.validTo());
        }
        if (req.gameKind() != null) {"""
new_apply = """        if (req.pointsReward() != null) {
            c.setPointsReward(req.pointsReward());
        }
        if (req.gameKind() != null) {"""
if old_apply not in t:
    raise SystemExit("applyChallenge block mismatch")
t = t.replace(old_apply, new_apply)

p.write_text(t, encoding="utf-8", newline="\n")
print("GamificationAdminController OK")
