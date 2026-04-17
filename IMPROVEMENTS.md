# Improvements Backlog

Prioritization framework:
1. **Make the game play better**
2. **Improve retention**
3. **Growth**

Within each tier, items are ordered top-down by rough priority/impact. Monetization lives in its own section since it cuts across tiers.

---

## 1. Game play

### 1. Question supply + voting on next day's question
Need a pipeline of upcoming questions. Let users vote on which question plays tomorrow (from a slate of candidates). Claude seeds top answers for each candidate up front so any choice is playable immediately.

### 2. Hard mode
Fewer strikes, no hints, maybe a time limit — for repeat players who finish too easily.

### 3. Feedback loop on question quality
A way to learn per-question whether it landed (engagement, completion rate, play time, share rate) so Claude can self-improve over time.

### 4. Improve hint quality
Current seeded hints are often too literal or too generic ("the classic remedy"). Hints should be sharp, specific, and on-brand with the Family Feud tone — clever enough to help without giving the answer away. Needs prompt tuning once the Claude content engine lands.

### 5. Automated question-quality eval + prompt iteration
An automated process that grades generated questions against Family Feud-style criteria (specificity, punchiness, plausible answer spread, answerability) — likely LLM-as-judge plus a few heuristic checks — and feeds the grades back into the question-generation prompt so it self-tunes over time. Complements #3: that one learns from real player behavior *after* a question ships; this one is an offline eval loop that catches bad questions *before* they ship and measures whether prompt changes are actually making things better.

### 6. Revisit "you already guessed that" UI
Currently shows as a floating Bootstrap alert at the top of the page. Should feel more integrated with the guess input — inline message near the input, subtle animation, no banner.

### 7. Iterate on host commentary (reveals + wrong guesses)
Host commentary is live on both #1 reveals and wrong-guess closeness feedback, but the copy needs tuning — tone, timing, and variety across question types. Should feel like a host, not a bit. Needs a variety pool so quips don't repeat across sessions, and Claude-generated lines per question rather than today's hardcoded placeholders.

### 8. Differentiate hint-assisted answers in the completion module
End-of-game summary currently shows clean solves and hint-assisted solves identically. Mark hint-assisted answers visually (icon, dimmer fill, label) so players see what they actually earned. Also sets up a more accurate Wordle-style share grid.

---

## 2. Retention

### 9. Post-game insights
After finishing, show context — "You scored better than 62% of today's players", "Your first guess matched the most popular first guess", "#3 was the hardest answer today (only 18% got it)." Cheap to compute, shareable, builds player identity.

### 10. Streak freezes
Duolingo-style. One per month so a missed day doesn't nuke a long streak. Reduces the "life got in the way and now I'm starting over" churn.

### 11. Archive of past questions
Let players replay old questions. A page where someone who just discovered the game can catch up on yesterday's or last week's.

---

## 3. Growth

### 12. Wordle-style share grid
Spoiler-free emoji result after each game (e.g. `Guess What 2026-04-16 — 4/5 ⬛🟩⬛🟩🟩`) paste-able anywhere. The single feature that made Wordle viral; near-zero cost, highest-leverage growth hook on the list.

### 13. Challenge-a-friend link
"I got 4/5, can you beat me?" — direct 1:1 growth loop. Complements the share grid but more personal/targeted.

### 14. Categories / themed verticals
Branded spin-offs ("Guess What Politics!", "Guess What Pop Culture!", "Guess What Sports!"). Each category gets its own daily question and audience. Opens product surface, makes sponsorship targeting easier, gives a natural expansion path.

### 15. Player-submitted questions (with Claude as editor)
Users submit candidate questions; Claude filters/polishes/seeds; winners get played and credited. Turns the community into the content engine over time.

---

## Monetization (cross-cutting)

### 16. Sponsored questions
Branded themed weeks ("Name a Netflix show everyone's watching"). Pairs naturally with categories — a sponsor owns a themed week inside a specific vertical. Use sparingly (~1/month) to avoid cheapening the experience.

### 17. Paid hints
Micro-purchases for extra hints — e.g., $0.99 for 10 hints, or $1.99/mo for unlimited. Simple, respects the player.

---

## In progress

*(nothing in flight)*

---

## Done

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
