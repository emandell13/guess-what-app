# Improvements Backlog

Prioritization framework — every item scored on two axes:
1. **Gameplay experience** (does it make the moment-to-moment game feel better?)
2. **Growth / virality / sharing** (does it pull in or re-engage players?)

Items are bucketed into impact tiers that combine both axes. Original thematic tags (gameplay / retention / growth) appear next to each title. Monetization lives in its own section since it's a different goal.

---

## Tier 1 — Ship next

The two highest combined-impact items. These compound on each other.

### 1. Post-game insights *(retention)*
After finishing, show context — "You scored better than 62% of today's players", "Your first guess matched the most popular first guess", "#3 was the hardest answer today (only 18% got it)." Dual-purpose: makes the game feel meaningful (gameplay) and produces share fodder (growth). Cheap to compute, builds player identity.

### 2. Contextualize the guess count in the summary *(gameplay)*
Add a single line next to the guess count — e.g. "4 guesses — better than 62% of today's players" — so the number has meaning instead of sitting as a raw integer. Cheap to compute from existing play data. A narrow, shippable slice of #1 — ship it as the appetizer while the fuller insights bake.

---

## Tier 2 — Right after Tier 1

Higher-impact items that don't compound quite as directly as Tier 1.

### 3. Challenge-a-friend link *(growth)*
"I got 4/5, can you beat me?" — direct 1:1 growth loop. Personal/targeted sharing hook; works standalone without a broader share-grid surface.

### 4. Theatrical perfect-game moment *(gameplay)*
Code already emits `game:perfect-game` but the modal just swaps text to "Perfect Game!". Add a celebration worthy of the achievement — confetti, distinct animation, maybe a "shareable highlight" beat. Rare event, so it should feel earned.

### 5. Post-completion flow refresh *(gameplay)*
A broader pass on the post-completion module — visual hierarchy, pacing between steps, how each step opens and closes, copy, what actually earns a step of its own vs. collapsing together. Several individual items (#2, #10, #12, #13, #16, #19) touch pieces of this, plus the in-progress personality pass on completion-module headings; a refresh would zoom out and rethink the whole sequence as one experience rather than patching step-by-step.

### 6. Archive of past questions *(retention)*
Let players replay old questions. A page where someone who just discovered the game can catch up on yesterday's or last week's. Growth via onboarding — new users currently have nothing to do on day 1.

---

## Tier 3 — Content quality loops

Ongoing / backend. These make questions and hints better over time but don't block this quarter's headline work.

### 7. Wire per-question engagement signals back into question generation *(gameplay)*
Per-question metrics — completion rate, abandonment, avg guesses, avg hints revealed — are already computed in `backend/routes/admin/questions.js` (`computeEngagementMetrics`) and surfaced in the admin panel. But `contentEngine.js` promotes candidates to scheduled questions using `pick_count` alone, ignoring whether past questions actually landed in play. This item is the missing half: feed engagement metrics into the generation/promotion prompts so Claude self-tunes based on real play behavior, not just explicit preference. Share-rate tracking is also not built — add if it turns out to be useful signal. Complements #8 (offline eval catching bad questions before ship); this one is the post-ship "did it land?" loop.

### 8. Automated question-quality eval + prompt iteration *(gameplay)*
An automated process that grades generated questions against Family Feud-style criteria (specificity, punchiness, plausible answer spread, answerability) — likely LLM-as-judge plus a few heuristic checks — and feeds the grades back into the question-generation prompt so it self-tunes over time. Complements #7: that one learns from real player behavior *after* a question ships; this one is an offline eval loop that catches bad questions *before* they ship and measures whether prompt changes are actually making things better.

### 9. Feedback mechanism on hints *(gameplay)*
Now that hints are generated via a candidate-and-rate flow, we need a way to learn which hints actually land with players. Simplest version: a thumbs up / thumbs down on the hint card after reveal. Richer signal: infer from behavior — did the player solve after revealing? How quickly? Did they give up right after? Feeds back into the rater pass (eventually training the rater on real preferences instead of only anchor examples) and into the generation prompt itself.

### 10. Add context to the vote form (Step 2) *(gameplay)*
Players get a bare input asking them to respond to tomorrow's question, with no explanation of what it does or why they should bother. One line of context ("You're helping seed the answer pool for tomorrow — your response plus others decide the top 5") and maybe a quick example would likely lift submission rates meaningfully — which in turn lifts content quality.

### 11. Categories / themed verticals *(growth)*
Branded spin-offs ("Guess What Politics!", "Guess What Pop Culture!", "Guess What Sports!"). Each category gets its own daily question and audience. Opens product surface, makes sponsorship targeting easier, gives a natural expansion path. Big swing — worth its own planning cycle.

---

## Tier 4 — Polish & longer bets

Real improvements, but lower impact or uncertain payoff. Ship opportunistically.

### 12. Distinguish the give-up state from losing *(gameplay)*
Today both show "Better luck next time!". A give-up deserves its own acknowledgement — not punitive, not identical to running out of strikes. Something that says "no shame, see you tomorrow" without treating it as a loss.

### 13. Extend the wave animation across the post-completion flow *(gameplay)*
The wave reveal currently used in one spot of the post-completion module should be reused in other places in the flow so the visual language feels consistent instead of appearing once and disappearing. Candidates: step transitions, step-intro reveals, any element that currently just fades or snaps in.

### 14. Hide the question picker after a player has already voted today *(gameplay)*
The future-question voting step should not re-show to a player who's already seen it and submitted votes on a given day. Today it appears every time they land back on the completion flow, which feels repetitive and risks double-voting noise. Track per-player/day vote state and skip the step on subsequent visits — collapse straight to the next step or show a brief "thanks, see you tomorrow" acknowledgement in its place.

### 15. Streak freezes *(retention)*
Duolingo-style. One per month so a missed day doesn't nuke a long streak. Reduces the "life got in the way and now I'm starting over" churn.

### 16. Strengthen the anon streak prompt in the completion module *(retention)*
Today anonymous players see "Track your streak - Sign up 🔥" — vague and low-conversion. Show what they'd unlock — e.g. "You'd have a 2-day streak if you signed in" — or a richer preview of what signed-in users get. Higher-signal ask, same real estate.

### 17. Player-submitted questions (with Claude as editor) *(growth)*
Users submit candidate questions; Claude filters/polishes/seeds; winners get played and credited. Turns the community into the content engine over time. Defer until #7 and #8 content loops are tight — otherwise the editor pass will be doing too much heavy lifting.

### 22. Move back to guesses from strikes *(gameplay)*
Revert the 3-strike max with game-over-on-strike-out (see Done: "Strikes + dramatic wrong-guess feedback") to an unbounded guess counter. Strikes add pressure but the hard loss state feels punitive for a daily game, and it cuts off the reveal moment prematurely. Keep the dramatic wrong-guess feedback (shake, host bubble) — just drop the hard fail.

### 23. Delay the end screen on a loss until all answers are revealed *(gameplay)*
Today the completion modal fires the moment a player strikes out, while the remaining answers are still animating onto the board. It steps on the final reveal beat. Hold the modal until the full board has filled in so the resolution plays out before the summary interrupts.

### 24. Stop host commentary from leaking unguessed answers on a right guess *(gameplay)*
Right-guess host quips are Claude-generated per-question and can reference other answers on the board — fine after the game is over, but mid-game they sometimes name an answer the player hasn't found yet, spoiling the rest of the round. Constrain the prompt (and/or post-filter generated lines) so commentary only riffs on the answer just guessed plus already-revealed answers, never the still-hidden ones. Pass the set of revealed answers into the request so the model has the guardrail explicitly.

---

## Parked

Items consciously deferred. Not dead — revisit when strategic priorities shift.

### 18. Wordle-style share grid *(growth)*
Spoiler-free emoji result after each game (e.g. `Guess What 2026-04-16 — 4/5 ⬛🟩⬛🟩🟩`) paste-able anywhere. The feature that made Wordle viral; still believe it's high-leverage eventually, but punted for now while focus stays on the core gameplay experience. Revisit when ready to push on virality.

### 19. Rebuild Step 3 around the share grid *(gameplay)*
Step 3 is literally named `shareStep` but today only offers social-follow links. When the Wordle-style share grid (#18) lands, make that the core of Step 3 — the actual "share" moment — and push social follow off-stage (secondary CTA or removed). Parked behind #18.

---

## Monetization (cross-cutting)

Evaluate separately from the gameplay/growth stack.

### 20. Sponsored questions
Branded themed weeks ("Name a Netflix show everyone's watching"). Pairs naturally with categories — a sponsor owns a themed week inside a specific vertical. Gated on #11. Use sparingly (~1/month) to avoid cheapening the experience.

### 21. Paid hints
Micro-purchases for extra hints — e.g., $0.99 for 10 hints, or $1.99/mo for unlimited. Simple, respects the player. Cheap to ship, but earn trust moments first before stacking monetization on the experience.

---

## Technical debt

### Dependency vulnerabilities
GitHub / Dependabot flagged 22 open vulnerabilities on main at the 2026-04-17 deploy (2 critical, 17 high, 1 moderate, 2 low). Nothing is actively broken, but the critical/high counts are high enough that a prioritized audit + `npm audit fix` pass is worth scheduling. Likely mostly transitive deps from older packages; check if any are in the request path (Express, Supabase client, Anthropic SDK) vs. dev-only tooling.

### Backend uses anon key for everything (RLS silently blocks DELETEs)
The backend's `backend/config/supabase.js` instantiates the Supabase client with `SUPABASE_ANON_KEY` for all calls — admin endpoints included. Row-Level-Security on the `questions` table allows SELECT/INSERT/UPDATE for the anon role but blocks DELETE, so any code path that calls `.delete()` (e.g. `backend/routes/admin/questions.js` DELETE `/admin/questions/:id`) silently affects 0 rows with no error. Discovered while trying to bulk-delete future-dated manual questions during the candidate-pool migration; had to fall back to running raw SQL in the Supabase editor. Fix: add `SUPABASE_SERVICE_ROLE_KEY` to Heroku config and instantiate a separate privileged client (e.g. `supabaseAdmin`) used only by admin/cron paths, leaving the anon client for user-facing endpoints.

---

## In progress

### Personality pass on completion-module headings
"You win!" / "Better luck next time!" / "Perfect Game!" are generic and drop the host voice the rest of the game has. Replace with a variety pool of host-style lines that vary by performance (and ideally by question), so the modal feels like the same host who's been talking to players all game.

### Iterate on host commentary (reveals + wrong guesses)
Host commentary is live on both #1 reveals and wrong-guess closeness feedback, but the copy needs tuning — tone, timing, and variety across question types. Should feel like a host, not a bit. Needs a variety pool so quips don't repeat across sessions, and Claude-generated lines per question rather than today's hardcoded placeholders.

---

## Done

### Mobile experience pass
Three-zone shell (sticky header + scrollable board + pinned input) keeps the question/strikes/hint on screen and the input above the keyboard on phones. Post-completion flow now renders as a proper bottom sheet on mobile: anchored to the viewport bottom, rounded top corners, grab-handle affordance, swipe-down-to-dismiss (touch events in `GameModal.setupSwipeToDismiss`), and a two-detent system driven by `.modal-content:has(input:focus)` — medium (~78% viewport) at rest, tall (fills above-keyboard space) when the vote input is focused. Step bodies scroll internally, safe-area bottom inset respected. iOS Safari autofill accessory bar suppressed, host-commentary/closeness bubbles relocated into the input zone so they anchor correctly. Design reference: `frontend/mobile-redesign-mockups.html`.

### "You already guessed that" → host bubble with per-guess Claude line
Duplicate correct guesses used to trigger a floating Bootstrap `alert-warning` at the top of the page — disconnected from both the input and the answer grid. Replaced with a third `.host-bubble` that shares the look of commentary + closeness feedback, plus a Claude-generated line per duplicate so the host can acknowledge fuzzy matches explicitly (e.g. "'Cell phone' is just 'check phone' in a trench coat — already on the board"). New `POST /guesses/duplicate-commentary` endpoint (Haiku-class, template fallback); `game:already-guessed` now carries both the raw user guess and the canonical answer so the backend can riff on the overlap. Also fixed the matching card's yellow flash, which had been silently broken — it was adding Bootstrap's `bg-warning`, but the revealed card's `bg-success.bg-opacity-25` rule (with `!important` and higher specificity) was winning, so nothing ever rendered. Switched to a dedicated `already-guessed-flash` class at matched specificity, and `AlreadyGuessedFeedback` fires the flash ~350ms before the host bubble so the card reacts first and the host lands as a response.

### Future-question voting in the post-completion flow
After finishing today's game, players see 3–5 candidate questions in `PickFavoriteStep` (frontend/js/components/modal/PickFavoriteStep.js) and can thumbs-up the ones they find interesting. Votes land in the `question_picks` table; candidates are surfaced fairest-first via an impression counter in `questionPickService.js`, and `contentEngine.js` uses pick counts to promote candidates to scheduled questions. Soft-skippable — advancing without picking is allowed. Gives the content engine an explicit-preference signal at peak engagement, complementing the post-hoc engagement metrics the admin panel now tracks (see #7 for the missing feedback loop back into generation).

### Differentiate hint-assisted answers in the completion summary
Answer boxes in the completion modal now render yellow when solved with a hint revealed, reusing the in-game `solved-with-hint` fill color (#FDEFA8) so the signal is consistent from the game grid through to the summary. Clean solves stay green, missed answers stay red — a three-state palette that also sets up a more accurate Wordle-style share grid (#18). State already existed in `localStorage` (`gwHinted_<date>`); `SummaryStep` just reads it and adds a `hint-assisted` class alongside `correct`.

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
