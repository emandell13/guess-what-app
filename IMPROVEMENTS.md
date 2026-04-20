# Improvements Backlog

Prioritization framework:
1. **Make the game play better**
2. **Improve retention**
3. **Growth**

Within each tier, items are ordered top-down by rough priority/impact. Monetization lives in its own section since it cuts across tiers.

---

## 1. Game play

### 1. Let players vote on future questions
After completing today's game, show players 3–5 candidate questions for a future day and let them thumbs-up / check the ones they find interesting (ranking possible later for sharper signal). Generates continuous crowdsourced quality signal and taps peak engagement right after the finish. Complements #3, which infers quality from play behavior post-hoc — this one is explicit preference. Lives in the post-completion module. Pipeline and Claude-seeded answers already exist, so this is purely the voting UI + storage + surfacing logic.

### 2. Hard mode
Fewer strikes, no hints, maybe a time limit — for repeat players who finish too easily.

### 3. Feedback loop on question quality
A way to learn per-question whether it landed (engagement, completion rate, play time, share rate) so Claude can self-improve over time.

### 4. Feedback mechanism on hints
Now that hints are generated via a candidate-and-rate flow, we need a way to learn which hints actually land with players. Simplest version: a thumbs up / thumbs down on the hint card after reveal. Richer signal: infer from behavior — did the player solve after revealing? How quickly? Did they give up right after? Feeds back into the rater pass (eventually training the rater on real preferences instead of only anchor examples) and into the generation prompt itself.

### 5. Automated question-quality eval + prompt iteration
An automated process that grades generated questions against Family Feud-style criteria (specificity, punchiness, plausible answer spread, answerability) — likely LLM-as-judge plus a few heuristic checks — and feeds the grades back into the question-generation prompt so it self-tunes over time. Complements #3: that one learns from real player behavior *after* a question ships; this one is an offline eval loop that catches bad questions *before* they ship and measures whether prompt changes are actually making things better.

### 6. Revisit "you already guessed that" UI
Currently shows as a floating Bootstrap alert at the top of the page. Should feel more integrated with the guess input — inline message near the input, subtle animation, no banner.

### 7. Personality pass on completion-module headings
"You win!" / "Better luck next time!" / "Perfect Game!" are generic and drop the host voice the rest of the game has. Replace with a variety pool of host-style lines that vary by performance (and ideally by question), so the modal feels like the same host who's been talking to players all game.

### 8. Contextualize the guess count in the summary
Add a single line next to the guess count — e.g. "4 guesses — better than 62% of today's players" — so the number has meaning instead of sitting as a raw integer. Cheap to compute from existing play data. A narrow, shippable slice of #13 (post-game insights).

### 9. Theatrical perfect-game moment
Code already emits `game:perfect-game` but the modal just swaps text to "Perfect Game!". Add a celebration worthy of the achievement — confetti, distinct animation, maybe a "shareable highlight" beat. Rare event, so it should feel earned.

### 10. Distinguish the give-up state from losing
Today both show "Better luck next time!". A give-up deserves its own acknowledgement — not punitive, not identical to running out of strikes. Something that says "no shame, see you tomorrow" without treating it as a loss.

### 11. Add context to the vote form (Step 2)
Players get a bare input asking them to respond to tomorrow's question, with no explanation of what it does or why they should bother. One line of context ("You're helping seed the answer pool for tomorrow — your response plus others decide the top 5") and maybe a quick example would likely lift submission rates meaningfully.

### 12. Rebuild Step 3 around the share grid once #17 ships
Step 3 is literally named `shareStep` but today only offers social-follow links. When the Wordle-style share grid (#17) lands, make that the core of Step 3 — the actual "share" moment — and push social follow off-stage (secondary CTA or removed).

### 23. Extend the wave animation across the post-completion flow
The wave reveal currently used in one spot of the post-completion module should be reused in other places in the flow so the visual language feels consistent instead of appearing once and disappearing. Candidates: step transitions, step-intro reveals, any element that currently just fades or snaps in.

### 24. Post-completion flow refresh
A broader pass on the post-completion module — visual hierarchy, pacing between steps, how each step opens and closes, copy, what actually earns a step of its own vs. collapsing together. Several individual items above (#7, #8, #10, #11, #12, #16, #23) touch pieces of this; a refresh would zoom out and rethink the whole sequence as one experience rather than patching step-by-step.

### 25. Improve the mobile experience
General mobile polish pass. Specific pain points TBD — likely touches guess input ergonomics, modal sizing, tap targets, and post-completion flow on small screens. Worth auditing end-to-end on a phone before scoping individual tickets.

### 26. Hide the question picker after a player has already voted today
The future-question voting step (#1) should not re-show to a player who's already seen it and submitted votes on a given day. Today it appears every time they land back on the completion flow, which feels repetitive and risks double-voting noise. Track per-player/day vote state and skip the step on subsequent visits — collapse straight to the next step or show a brief "thanks, see you tomorrow" acknowledgement in its place.

---

## 2. Retention

### 13. Post-game insights
After finishing, show context — "You scored better than 62% of today's players", "Your first guess matched the most popular first guess", "#3 was the hardest answer today (only 18% got it)." Cheap to compute, shareable, builds player identity.

### 14. Streak freezes
Duolingo-style. One per month so a missed day doesn't nuke a long streak. Reduces the "life got in the way and now I'm starting over" churn.

### 15. Archive of past questions
Let players replay old questions. A page where someone who just discovered the game can catch up on yesterday's or last week's.

### 16. Strengthen the anon streak prompt in the completion module
Today anonymous players see "Track your streak - Sign up 🔥" — vague and low-conversion. Show what they'd unlock — e.g. "You'd have a 2-day streak if you signed in" — or a richer preview of what signed-in users get. Higher-signal ask, same real estate.

---

## 3. Growth

### 17. Wordle-style share grid
Spoiler-free emoji result after each game (e.g. `Guess What 2026-04-16 — 4/5 ⬛🟩⬛🟩🟩`) paste-able anywhere. The single feature that made Wordle viral; near-zero cost, highest-leverage growth hook on the list.

### 18. Challenge-a-friend link
"I got 4/5, can you beat me?" — direct 1:1 growth loop. Complements the share grid but more personal/targeted.

### 19. Categories / themed verticals
Branded spin-offs ("Guess What Politics!", "Guess What Pop Culture!", "Guess What Sports!"). Each category gets its own daily question and audience. Opens product surface, makes sponsorship targeting easier, gives a natural expansion path.

### 20. Player-submitted questions (with Claude as editor)
Users submit candidate questions; Claude filters/polishes/seeds; winners get played and credited. Turns the community into the content engine over time.

---

## Monetization (cross-cutting)

### 21. Sponsored questions
Branded themed weeks ("Name a Netflix show everyone's watching"). Pairs naturally with categories — a sponsor owns a themed week inside a specific vertical. Use sparingly (~1/month) to avoid cheapening the experience.

### 22. Paid hints
Micro-purchases for extra hints — e.g., $0.99 for 10 hints, or $1.99/mo for unlimited. Simple, respects the player.

---

## Technical debt

### Dependency vulnerabilities
GitHub / Dependabot flagged 22 open vulnerabilities on main at the 2026-04-17 deploy (2 critical, 17 high, 1 moderate, 2 low). Nothing is actively broken, but the critical/high counts are high enough that a prioritized audit + `npm audit fix` pass is worth scheduling. Likely mostly transitive deps from older packages; check if any are in the request path (Express, Supabase client, Anthropic SDK) vs. dev-only tooling.

### Backend uses anon key for everything (RLS silently blocks DELETEs)
The backend's `backend/config/supabase.js` instantiates the Supabase client with `SUPABASE_ANON_KEY` for all calls — admin endpoints included. Row-Level-Security on the `questions` table allows SELECT/INSERT/UPDATE for the anon role but blocks DELETE, so any code path that calls `.delete()` (e.g. `backend/routes/admin/questions.js` DELETE `/admin/questions/:id`) silently affects 0 rows with no error. Discovered while trying to bulk-delete future-dated manual questions during the candidate-pool migration; had to fall back to running raw SQL in the Supabase editor. Fix: add `SUPABASE_SERVICE_ROLE_KEY` to Heroku config and instantiate a separate privileged client (e.g. `supabaseAdmin`) used only by admin/cron paths, leaving the anon client for user-facing endpoints.

---

## In progress

### Iterate on host commentary (reveals + wrong guesses)
Host commentary is live on both #1 reveals and wrong-guess closeness feedback, but the copy needs tuning — tone, timing, and variety across question types. Should feel like a host, not a bit. Needs a variety pool so quips don't repeat across sessions, and Claude-generated lines per question rather than today's hardcoded placeholders.

---

## Done

### Differentiate hint-assisted answers in the completion summary
Answer boxes in the completion modal now render yellow when solved with a hint revealed, reusing the in-game `solved-with-hint` fill color (#FDEFA8) so the signal is consistent from the game grid through to the summary. Clean solves stay green, missed answers stay red — a three-state palette that also sets up a more accurate Wordle-style share grid (#17). State already existed in `localStorage` (`gwHinted_<date>`); `SummaryStep` just reads it and adds a `hint-assisted` class alongside `correct`.

### Hint quality overhaul
Replaced single-shot hint generation with a two-pass flow: Claude generates 3 candidates per answer, then a separate rating call picks the best using anchor "good" and "too easy" examples drawn from actual user taste feedback. Also routed hint calls specifically to Opus 4.7 (other LLM calls still use the env default) — the creative task benefits from the stronger model, cost impact is pennies per day. The rater pass is what finally prevented the direct-object-naming failures the generator alone kept falling into.

### "Closeness" feedback on wrong guesses
Wrong guesses now get a host-bubble response instead of silent rejection. If others said the same thing, show "Ooh — 12 people said that too. Didn't crack top 5." If nobody did, "Not a soul said that. Bold." Shares the .host-bubble aesthetic with #1-reveal commentary — both float above the guess form, no dim layer, ~2.5s on-screen. Backend counts matching `votes.response` rows; frontend emits `poolCount` through `game:incorrect-guess` to a new `ClosenessFeedback` component.

### Reposition host commentary above the guess form
#1-reveal commentary previously lived centered mid-viewport with its own dim layer — dramatic as a finale, but disruptive when #1 is revealed mid-game. Moved it to the same above-form slot as the closeness bubble so it feels like a continuous host presence instead of staging a second spotlight.

### Claude-written commentary on reveals
After the #1 answer is revealed, a one-line quip from Claude ("Of course sleeping in won — you're all monsters"). Personality baked in. Cheap to run, makes the game feel alive.

### Better questions (Claude content engine)
Question quality is the #1 lever. Punchy, specific, slightly spicy — Family Feud style. Claude generates questions + seeded answers (with plausible vote weights) so the game is ready to play out of the gate. Real user votes layer on top and eventually fade Claude seeds out.

### Hints redesign
Remove hints being tied to a specific answer. User just asks for "a hint" and one is revealed. Hints reveal in a fixed sequence (either from answer #1 down or #5 up — TBD). User figures out which answer the hint belongs to.

### Strikes + dramatic wrong-guess feedback
Reverted from the plain "Guesses:" counter back to 3-strike max with game over on strike-out. Wrong guesses now have real feedback: strike circle fills, red shake on the input + button, visible strike reveal animation.

### Dramatic correct-guess moment
Correct guesses now feel theatrical: card lifts + the rest of the board dims, vote count animates up from 0 instead of snapping in, card fades back after reveal.

### Pin guess input to the bottom of the viewport
Guess form is now fixed to the bottom of the window on all screen sizes (previously only mobile), so there's an obvious next action when landing on the page. Also shrank the question `h2` so it doesn't dominate the viewport at wider widths.
