# -*- coding: utf-8 -*-
"""Patch admin gamification daily challenge UI: game kind first, no date fields."""
from pathlib import Path

ts = Path(r"src/app/admin/gamification/admin-gamification.component.ts")
text = ts.read_text(encoding="utf-8")

old_iface = """interface NewChallengeForm {
  title: string;
  description: string;
  pointsReward: number;
  validFrom: string;
  validTo: string;
  gameKind: LudificationGameKind;
  targetId: number | null;
  active: boolean;
}"""
new_iface = """interface NewChallengeForm {
  title: string;
  description: string;
  pointsReward: number;
  gameKind: LudificationGameKind;
  targetId: number | null;
  active: boolean;
}"""
if old_iface not in text:
    raise SystemExit("interface block not found")
text = text.replace(old_iface, new_iface)

# After editBadgeId line, add challengeKind
needle = "  editBadgeId: number | null = null;\n\n  newChallenge:"
if needle not in text:
    raise SystemExit("needle for challengeKind not found")
text = text.replace(
    needle,
    "  editBadgeId: number | null = null;\n\n  /** Shown after admin picks a game type. */\n"
    "  challengeKind: LudificationGameKind | null = null;\n\n  newChallenge:",
)

old_new = """  newChallenge: NewChallengeForm = {
    title: '',
    description: '',
    pointsReward: 10,
    validFrom: '',
    validTo: '',
    gameKind: 'QUIZ',
    targetId: null,
    active: true,
  };"""
new_new = """  newChallenge: NewChallengeForm = {
    title: '',
    description: '',
    pointsReward: 10,
    gameKind: 'QUIZ',
    targetId: null,
    active: true,
  };"""
if old_new not in text:
    raise SystemExit("newChallenge init not found")
text = text.replace(old_new, new_new)

old_payload = """  private challengePayload(): Record<string, unknown> {
    const c = this.newChallenge;
    const payload: Record<string, unknown> = {
      title: c.title.trim(),
      description: c.description || null,
      pointsReward: Number(c.pointsReward) || 0,
      gameKind: c.gameKind,
      targetId: c.targetId == null ? null : Number(c.targetId),
      active: c.active !== false,
    };
    if (c.validFrom) {
      payload['validFrom'] = new Date(c.validFrom).toISOString();
    }
    if (c.validTo) {
      payload['validTo'] = new Date(c.validTo).toISOString();
    }
    return payload;
  }"""
new_payload = """  private challengePayload(): Record<string, unknown> {
    const c = this.newChallenge;
    const kind = this.challengeKind;
    if (!kind) {
      return {};
    }
    return {
      title: c.title.trim(),
      description: c.description || null,
      pointsReward: Number(c.pointsReward) || 0,
      gameKind: kind,
      targetId: c.targetId == null ? null : Number(c.targetId),
      active: c.active !== false,
    };
  }"""
if old_payload not in text:
    raise SystemExit("challengePayload not found")
text = text.replace(old_payload, new_payload)

old_save = """  saveChallenge(): void {
    const title = String(this.newChallenge.title ?? '').trim();
    if (!title) {
      this.error.set('Challenge title required.');
      return;
    }
    this.busy.set(true);
    this.gamification
      .adminCreateChallenge(this.challengePayload())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.newChallenge = {
            title: '',
            description: '',
            pointsReward: 10,
            validFrom: '',
            validTo: '',
            gameKind: 'QUIZ',
            targetId: null,
            active: true,
          };
          this.refreshAll();
        },
        error: () => this.error.set('Create challenge failed.'),
      });
  }"""
new_save = """  saveChallenge(): void {
    if (!this.challengeKind) {
      this.error.set('Select a game type first.');
      return;
    }
    const title = String(this.newChallenge.title ?? '').trim();
    if (!title) {
      this.error.set('Challenge title required.');
      return;
    }
    this.newChallenge.gameKind = this.challengeKind;
    this.busy.set(true);
    this.gamification
      .adminCreateChallenge(this.challengePayload())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.challengeKind = null;
          this.newChallenge = {
            title: '',
            description: '',
            pointsReward: 10,
            gameKind: 'QUIZ',
            targetId: null,
            active: true,
          };
          this.refreshAll();
        },
        error: () => this.error.set('Create challenge failed.'),
      });
  }"""
if old_save not in text:
    raise SystemExit("saveChallenge not found")
text = text.replace(old_save, new_save)

ts.write_text(text, encoding="utf-8", newline="\n")
print("TS OK")

html = Path(r"src/app/admin/gamification/admin-gamification.component.html")
ht = html.read_text(encoding="utf-8")

old_block = """      <h2>Daily challenges</h2>
      <p class="dash-p">Reward points when the user completes the target game in the valid date range.</p>
      <div class="form-grid">
        <label>
          Title
          <input type="text" [(ngModel)]="newChallenge.title" name="ct" />
        </label>
        <label>
          Points
          <input type="number" [(ngModel)]="newChallenge.pointsReward" name="cp" />
        </label>
        <label>
          Game kind
          <select [(ngModel)]="newChallenge.gameKind" name="cgk">
            @for (k of gameKinds; track k) {
              <option [value]="k">{{ k }}</option>
            }
          </select>
        </label>
        <label>
          Target id (optional)
          <input type="number" [(ngModel)]="newChallenge.targetId" name="ctid" />
        </label>
        <label>
          Valid from
          <input type="date" [(ngModel)]="newChallenge.validFrom" name="cvf" />
        </label>
        <label>
          Valid to
          <input type="date" [(ngModel)]="newChallenge.validTo" name="cvt" />
        </label>
        <label class="span-2">
          Description
          <textarea [(ngModel)]="newChallenge.description" name="cd" rows="2"></textarea>
        </label>
        <label class="chk">
          <input type="checkbox" [(ngModel)]="newChallenge.active" name="cact" />
          Active
        </label>
      </div>
      <button type="button" class="btn-primary main-act" (click)="saveChallenge()" [disabled]="busy()">Create challenge</button>"""

new_block = """      <h2>Daily challenges</h2>
      <p class="dash-p">Pick a game type, then fill the form. Each new challenge is active for 24 hours from creation (set automatically).</p>
      <div class="form-grid">
        <label class="span-2">
          Game kind
          <select [(ngModel)]="challengeKind" name="cgkpick">
            <option [ngValue]="null">Select a game type...</option>
            @for (k of gameKinds; track k) {
              <option [ngValue]="k">{{ k }}</option>
            }
          </select>
        </label>
      </div>
      @if (challengeKind) {
        <div class="form-grid challenge-form-block">
          <label>
            Title
            <input type="text" [(ngModel)]="newChallenge.title" name="ct" />
          </label>
          <label>
            Points
            <input type="number" [(ngModel)]="newChallenge.pointsReward" name="cp" />
          </label>
          <label>
            Target id (optional)
            <input type="number" [(ngModel)]="newChallenge.targetId" name="ctid" />
          </label>
          <label class="span-2">
            Description
            <textarea [(ngModel)]="newChallenge.description" name="cd" rows="2"></textarea>
          </label>
          <label class="chk">
            <input type="checkbox" [(ngModel)]="newChallenge.active" name="cact" />
            Active
          </label>
        </div>
        <button type="button" class="btn-primary main-act" (click)="saveChallenge()" [disabled]="busy()">Create challenge</button>
      }"""

if old_block not in ht:
    raise SystemExit("HTML block not found")
ht = ht.replace(old_block, new_block)
html.write_text(ht, encoding="utf-8", newline="\n")
print("HTML OK")
