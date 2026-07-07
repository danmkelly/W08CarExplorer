# Beep-Beep Car Explorer -- Automated Test Plan

**Author:** Keelin O'Sullivan (@Keelin)
**Date:** 2026-07-07
**Version:** 1.0.0
**Codebase:** index.html (single-file, HTML/CSS/JS inline), worker.js (Cloudflare Worker proxy)

---

## Test Environment

- Headless browser: Playwright (Chromium), with Firefox fallback for Web Speech API variance
- Viewport presets: 1440x900 (desktop), 768x1024 (tablet), 375x667 (mobile)
- localStorage pre-seeding required for memory tests
- Network mocking needed for API failure tests (cars.json fetch, DeepSeek Worker proxy)
- Voice STT/TTS: mock `window.SpeechRecognition` and `window.speechSynthesis` where unavailable
- Car test data: copy of cars.json cached for offline comparison

---

## 1. Greeting Flow

### TEST-001: Beep-Beep introduces itself on first visit
- **Category:** Conversation Flow
- **Description:** Verify Beep-Beep sends the welcome sequence when no prior memory exists.
- **Steps:**
  1. Clear localStorage (`localStorage.clear()`)
  2. Load page
  3. Observe chat messages
- **Expected behaviour:** Bot messages appear in sequence: (1) self-identification as AI chatbot with capabilities listed (make, type, price, year, fuel, transmission), (2) consent question ("Would you like me to remember your preferences? Yes or No."), (3) capability summary. Beep-Beep label does not show a known name.
- **Severity:** High
- **Automated verification:**
  - Assert `document.querySelectorAll(".msg.bot").length >= 3`
  - Assert first bot message contains "I'm Beep-Beep" and "AI chatbot"
  - Assert bot label does not contain "knows"
  - Assert consent prompt visible ("remember" and "Yes or No")

### TEST-002: Beep-Beep asks for name after consent
- **Category:** Conversation Flow
- **Description:** Verify the name-collection flow triggers after positive consent.
- **Steps:**
  1. Clear localStorage, load page, wait for consent prompt
  2. Type "Yes" and send
  3. Observe next bot message
- **Expected behaviour:** After "Yes," bot replies acknowledging consent and asking "What should I call you?" `expectingName` flag set to true.
- **Severity:** High
- **Automated verification:**
  - Assert bot response contains "What should I call you?"
  - Evaluate: `window.expectingName === true`
  - Assert `localStorage.getItem("beepbeep_memory")` contains `consent: "yes"`

### TEST-003: Beep-Beep greets returning user by name
- **Category:** Conversation Flow / Memory
- **Description:** Verify the bot recognises a previously named user on return visit.
- **Steps:**
  1. Pre-seed localStorage: `beepbeep_memory = {"visits":2,"userName":"Keelin","consent":"yes","recentSearches":["Toyota SUV","Honda under 15000"]}`
  2. Load page
- **Expected behaviour:** First bot message: "Welcome back, Keelin! Ready to find your next car?" Suggestion chips include recent search terms. Bot label shows "knows Keelin."
- **Severity:** High
- **Automated verification:**
  - Assert first bot message contains "Welcome back" and "Keelin"
  - Assert `document.querySelectorAll(".chat-sugg-btn").length >= 3`
  - Assert bot label text contains "knows Keelin"

### TEST-004: Name capture rejects non-name input
- **Category:** Conversation Flow / Edge Cases
- **Description:** Verify that multi-word sentences are not captured as a name.
- **Steps:**
  1. Clear localStorage, load page, accept consent, wait for name prompt
  2. Type "I need a Toyota SUV under $20,000" and send
- **Expected behaviour:** Name is NOT stored. Input goes through normal car search processing. `beepbeepMemory.userName` remains empty or unchanged.
- **Severity:** Medium
- **Automated verification:**
  - Evaluate: `JSON.parse(localStorage.getItem("beepbeep_memory")).userName === ""`
  - Assert car search processing triggered (car cards rendered or bot responds with car information)

---

## 2. Car Search Queries

### TEST-005: Car search by make ("Toyota")
- **Category:** Car Search
- **Description:** Verify a make-based query returns matching cars.
- **Steps:**
  1. Type "Show me Toyota cars" and send
  2. Observe results panel
- **Expected behaviour:** Results panel loads with Toyota cars. Bot messages summarise findings. Car cards show Toyota vehicles. Cards include make, model, year, price, fuel, transmission, and mileage.
- **Severity:** Critical
- **Automated verification:**
  - Assert `document.querySelectorAll(".car-card").length > 0`
  - Assert at least one card text contains "Toyota"
  - Assert no console errors during fetch
  - Assert loading spinner is not active after results load

### TEST-006: Car search by type ("SUV")
- **Category:** Car Search
- **Description:** Verify type-filtered search returns only cars of the specified type.
- **Steps:**
  1. Type "Show me SUVs" and send
  2. Inspect all returned car cards
- **Expected behaviour:** All returned cars are SUVs (or CUVs accepted as SUV variants). No sedans, trucks, or coupes appear in the primary results.
- **Severity:** Critical
- **Automated verification:**
  - Assert `document.querySelectorAll(".car-card").length > 0`
  - Assert result count > 0
  - Assert no clearly incompatible vehicle types appear (e.g., convertible in SUV search)

### TEST-007: Car search by price range ("under $15,000")
- **Category:** Car Search
- **Description:** Verify price-filtered search returns cars within the stated range.
- **Steps:**
  1. Type "cars under 15000" and send
  2. Inspect returned car card prices
- **Expected behaviour:** All returned cars have prices at or below $15,000. No cars above $15,000 displayed.
- **Severity:** High
- **Automated verification:**
  - Assert all visible car cards show prices <= 15000
  - Assert result count > 0

### TEST-008: Combined query ("red Toyota SUVs under $20,000")
- **Category:** Car Search
- **Description:** Verify multi-dimensional search (make + type + color + price) works correctly.
- **Steps:**
  1. Type "red Toyota SUVs under 20000" and send
  2. Inspect results
- **Expected behaviour:** Results show only red Toyota SUVs priced under $20,000. No Honda, no sedans, no cars over $20,000 appear.
- **Severity:** High
- **Automated verification:**
  - Assert all cards show Toyota make
  - Assert all cards show SUV type or compatible body style
  - Assert all cards show prices < 20000
  - Assert color filter reflects "red" or results contain red vehicles
  - Assert result count > 0

### TEST-009: Ambiguous query ("sedan")
- **Category:** Car Search / Edge Cases
- **Description:** Verify the bot handles a type-only query without make specification.
- **Steps:**
  1. Type "sedan" and send
- **Expected behaviour:** Bot returns sedan results across all makes. Alternatively, bot prompts for disambiguation ("I found sedans from Toyota, Honda, and Ford. Any make preference?"). No crash, no empty results without explanation.
- **Severity:** Medium
- **Automated verification:**
  - Assert bot response is non-empty
  - Assert either car cards shown, OR disambiguation prompt appears
  - Assert no console errors

---

## 3. Filter Bar Interaction

### TEST-010: Manual filter updates chat context
- **Category:** Filter Sync
- **Description:** Verify that manually changing the filter bar sends a context update to the chat.
- **Steps:**
  1. Perform any car search
  2. Click a manufacturer filter chip (e.g., "Toyota") in the filter bar
- **Expected behaviour:** Chat displays a system message indicating "Filter: Toyota" or similar. Car results update to show only Toyota vehicles. The filter chip is visually selected.
- **Severity:** High
- **Automated verification:**
  - Assert filter chip has "active" or "selected" class after click
  - Assert car card results filtered to selected manufacturer
  - Assert chat message added reflecting the filter change

### TEST-011: Chat query updates filter bar
- **Category:** Filter Sync
- **Description:** Verify that a chat query containing filter terms updates the filter bar chips.
- **Steps:**
  1. Type "Ford cars under $10,000" and send
- **Expected behaviour:** The manufacturer filter shows "Ford" as selected. The price filter reflects the under-$10,000 range. The filter bar visually matches the query constraints.
- **Severity:** High
- **Automated verification:**
  - Assert manufacturer filter chip for "Ford" is active/selected
  - Assert price range filter reflects <= 10000
  - Assert car cards match the combined constraints

### TEST-012: Clearing filters resets to full dataset
- **Category:** Filter Sync
- **Description:** Verify that clearing all filters returns the full car dataset.
- **Steps:**
  1. Apply manufacturer and price filters
  2. Click "Clear all filters" or equivalent
- **Expected behaviour:** All filter chips return to unselected state. Car results return to the full dataset (all makes, all prices). Chat reflects the reset.
- **Severity:** Medium
- **Automated verification:**
  - Assert no filter chips have "active" or "selected" class
  - Assert car card count returns to unfiltered total
  - Assert chat message reflects cleared filters

### TEST-013: Multiple simultaneous filters work together
- **Category:** Filter Sync
- **Description:** Verify that combining manufacturer, type, fuel, and price filters produces correct intersection results.
- **Steps:**
  1. Select manufacturer "Honda"
  2. Select type "Sedan"
  3. Select fuel "Gasoline"
  4. Set price slider or range to $5,000-$15,000
- **Expected behaviour:** Results show only Honda Sedans with gasoline engines priced between $5,000 and $15,000. No OR behaviour; strict AND filtering.
- **Severity:** High
- **Automated verification:**
  - Assert all cards show Honda make
  - Assert all cards show Sedan type
  - Assert all cards show Gasoline fuel
  - Assert all cards priced >= 5000 and <= 15000

---

## 4. Price Range Filtering

### TEST-014: Minimum price filter works
- **Category:** Filter Sync
- **Description:** Verify that setting a minimum price excludes lower-priced cars.
- **Steps:**
  1. Set minimum price to $10,000 via filter bar or chat ("cars over $10,000")
- **Expected behaviour:** All displayed cars have price >= $10,000. No sub-$10,000 cars appear.
- **Severity:** Medium
- **Automated verification:**
  - Assert all visible car cards show prices >= 10000

### TEST-015: Maximum price filter works
- **Category:** Filter Sync
- **Description:** Verify that setting a maximum price excludes higher-priced cars.
- **Steps:**
  1. Set maximum price to $5,000 via filter bar or chat ("cars under $5,000")
- **Expected behaviour:** All displayed cars have price <= $5,000. No cars above $5,000 appear.
- **Severity:** Medium
- **Automated verification:**
  - Assert all visible car cards show prices <= 5000

### TEST-016: Year range filter works
- **Category:** Filter Sync
- **Description:** Verify that year range filtering correctly constrains results.
- **Steps:**
  1. Type "cars from 2018 to 2022" and send
- **Expected behaviour:** All returned cars have year between 2018 and 2022 inclusive.
- **Severity:** Medium
- **Automated verification:**
  - Assert all visible car cards show year >= 2018 and <= 2022

---

## 5. Car Comparison

### TEST-017: Comparison modal opens with two selected cars
- **Category:** Comparison
- **Description:** Verify the car comparison modal opens when two cars are selected for comparison.
- **Steps:**
  1. Perform a car search
  2. Click "Compare" on two car cards, or trigger comparison via chat
- **Expected behaviour:** Comparison modal opens showing two car cards side by side or a comparison table. Modal shows "Compare Cars" or similar title. Overlay covers the background.
- **Severity:** Critical
- **Automated verification:**
  - Assert comparison modal is visible (has "open" class or `display` not none)
  - Assert two car entries visible in the comparison view
  - Assert comparison attributes visible (make, model, year, price, mileage)

### TEST-018: Comparison highlights differences between cars
- **Category:** Comparison
- **Description:** Verify the comparison view visually distinguishes differences between the two cars.
- **Steps:**
  1. Open comparison modal with two cars of different makes, prices, and mileages
- **Expected behaviour:** Key differences are highlighted (e.g., bold text, color highlight for better value). Both cars' full specs are readable. User can close the modal and return to browsing.
- **Severity:** High
- **Automated verification:**
  - Assert both cars' prices are visible
  - Assert both cars' mileages are visible
  - Assert comparison view shows both entries with clear attribute labels
  - Assert modal can be closed (close button or overlay click)

---

## 6. MCP Data Loading

### TEST-019: Successful cars.json fetch and render
- **Category:** Data Integration
- **Description:** Verify cars.json fetches successfully and populates the backend data store.
- **Steps:**
  1. Load page
  2. Wait for fetch to complete
  3. Trigger a car search
- **Expected behaviour:** Cars are fetched and parsed from cars.json. The full ~1200 cars with 8+ filter dimensions are available. Car search queries return results from the live data.
- **Severity:** Critical
- **Automated verification:**
  - Verify network call to `cars.json` succeeds (status 200)
  - Evaluate that internal car array length >= 1000
  - Assert car search returns results from the fetched data (not empty)

### TEST-020: Cache reuse on subsequent queries
- **Category:** Data Integration
- **Description:** Verify the car data is cached after first fetch and reused for subsequent queries.
- **Steps:**
  1. Load page, wait for initial fetch
  2. Trigger a car search and note fetch count
  3. Trigger a second query
- **Expected behaviour:** cars.json is fetched once. Subsequent queries use the cached data. No additional network call to cars.json on the second query.
- **Severity:** Medium
- **Automated verification:**
  - Count network calls to `cars.json` -- assert count <= 1 after second query
  - Assert car results render from cache on second query

### TEST-021: cars.json fetch failure -- graceful degradation
- **Category:** Data Integration / Robustness
- **Description:** Verify the bot handles cars.json fetch failure gracefully.
- **Steps:**
  1. Block or mock cars.json to return 404 or 500
  2. Load page
- **Expected behaviour:** Bot displays a visible error message indicating car data could not be loaded. A retry button is offered. Chat functionality (LLM conversation) continues to work for general queries. The bot does not crash.
- **Severity:** Critical
- **Automated verification:**
  - Mock fetch to cars.json to return `{ok: false, status: 500}`
  - Assert error message visible on page
  - Assert retry button or fallback text present
  - Assert no uncaught exceptions
  - Assert chat input still functional

---

## 7. Human Handoff

### TEST-022: Typing "human" triggers dataset and contact information
- **Category:** Conversation Flow
- **Description:** Verify the "human" keyword returns data source and project contact information.
- **Steps:**
  1. Type "human" and send
- **Expected behaviour:** Bot returns dataset information including: Kaggle Craigslist Vehicles dataset citation, a link to the original Kaggle data, and project contact (beep-beep@car-explorer.ai). Email is a clickable `mailto:` link.
- **Severity:** Critical
- **Automated verification:**
  - Assert bot message contains "Kaggle" or "Craigslist Vehicles" or dataset reference
  - Assert bot message contains "beep-beep@car-explorer.ai"
  - Assert email link has `href` starting with `mailto:`

### TEST-023: Ramp bar click triggers handoff
- **Category:** UI/UX
- **Description:** Verify the persistent "Prefer the full dataset?" bar triggers the same handoff as typing "human."
- **Steps:**
  1. Click the `.chat-human-ramp` bar at the bottom of chat
- **Expected behaviour:** Chat input fills with "human." Send is triggered. Same contact/dataset messages appear as TEST-022.
- **Severity:** Medium
- **Automated verification:**
  - Click `.chat-human-ramp`
  - Assert input value becomes "human" (before auto-send)
  - After send: assert same contact verification as TEST-022

---

## 8. Memory / Persistence

### TEST-024: Consent flow -- "no" prevents all storage
- **Category:** Memory
- **Description:** Verify that declining consent prevents any localStorage writes.
- **Steps:**
  1. Clear localStorage, load page
  2. When consent prompt appears, type "No" and send
  3. Check localStorage and observe behaviour
- **Expected behaviour:** `beepbeep_memory.consent` is "no." No name is stored. No search history is stored. On subsequent interactions, no data is persisted. On page reload, user is treated as new visitor.
- **Severity:** Critical
- **Automated verification:**
  - Evaluate: `JSON.parse(localStorage.getItem("beepbeep_memory")).consent === "no"`
  - Assert `beepbeep_memory.userName` is empty
  - Reload page; assert `beepbeep_memory.visits` is reset or 1

### TEST-025: Name is stored and survives page refresh
- **Category:** Memory
- **Description:** Verify the user's name persists across page reloads when consent is given.
- **Steps:**
  1. Accept consent, provide name "Keelin"
  2. Trigger a car search
  3. Reload page
- **Expected behaviour:** After reload, `beepbeep_memory.userName === "Keelin"`. Bot greets with "Welcome back, Keelin." Search history preserved.
- **Severity:** Critical
- **Automated verification:**
  - Before reload: evaluate `JSON.parse(localStorage.getItem("beepbeep_memory")).userName === "Keelin"`
  - After reload: evaluate same, assert still "Keelin"
  - Assert first bot message after reload contains "Keelin"

### TEST-026: Clear memory button works irreversibly
- **Category:** Memory
- **Description:** Verify the "Clear memory" button removes all localStorage data and resets state.
- **Steps:**
  1. Set up memory with name, consent, visit count, and search history
  2. Click "Clear memory" button
  3. Check localStorage and UI state
- **Expected behaviour:** `localStorage.getItem("beepbeep_memory")` returns null. Bot sends confirmation message ("All clear!"). Bot label resets to default (no name shown). `expectingName` becomes true.
- **Severity:** High
- **Automated verification:**
  - Click clear-memory button
  - Assert `localStorage.getItem("beepbeep_memory")` is null
  - Assert bot message contains "clear" or "forgotten" or "All clear"
  - Assert bot label does not contain "knows"
  - Evaluate: `window.expectingName === true`

### TEST-027: Return visit without consent resets counters
- **Category:** Memory / Edge Cases
- **Description:** Verify that a user who did not consent is treated as new on every return.
- **Steps:**
  1. Clear localStorage, load page, respond "No" to consent
  2. Perform a car search
  3. Reload page
- **Expected behaviour:** On reload, visit count is reset. No name stored. No search history remembered. The consent prompt reappears. The bot treats them as a new visitor.
- **Severity:** Medium
- **Automated verification:**
  - After reload: evaluate `JSON.parse(localStorage.getItem("beepbeep_memory")).consent === "no"`
  - Assert `beepbeep_memory.recentSearches` is empty
  - Assert `beepbeep_memory.visits` is 1 (not incremented from prior visit)
  - Assert consent prompt appears again

---

## 9. Voice STT (Speech-to-Text)

### TEST-028: Microphone activation and listening state
- **Category:** Voice
- **Description:** Verify the microphone button toggles listening state correctly.
- **Steps:**
  1. Load page in a browser supporting Web Speech API (Chromium)
  2. Click mic button
  3. Click mic button again
- **Expected behaviour:** First click: mic button gets "listening" class with animation. Speech recognition starts. Second click: "listening" class removed. Recognition stops.
- **Severity:** High
- **Automated verification:**
  - Click `.chat-mic`: assert button has "listening" class
  - Verify recognition start called (spy on mock `SpeechRecognition.start`)
  - Click again: assert "listening" absent, verify stop called
  - In unsupported browser: assert mic button hidden (`display: none`)

### TEST-029: STT transcription populates input and auto-sends
- **Category:** Voice
- **Description:** Verify speech recognition results fill the chat input and trigger auto-send.
- **Steps:**
  1. Click mic button
  2. Simulate speech recognition result: "Toyota SUVs under 15 thousand"
- **Expected behaviour:** `chatInput.value` set to the transcribed text. `spokeLast` flag set to true. Auto-send triggered. Mic loses listening class. Bot response generation starts.
- **Severity:** High
- **Automated verification:**
  - Simulate recognition `onresult` with transcript "Toyota SUVs under 15 thousand"
  - Assert `document.getElementById("chatInput").value` matches transcript
  - Assert `window.spokeLast === true`
  - Assert send triggered (user message visible in chat)
  - Assert mic "listening" class absent

---

## 10. Voice TTS (Text-to-Speech)

### TEST-030: Speaker icon on bot messages triggers TTS playback
- **Category:** Voice
- **Description:** Verify clicking the speaker icon on a bot message reads text aloud.
- **Steps:**
  1. Trigger a bot message (e.g., car search response)
  2. Click speaker icon on the bot message
- **Expected behaviour:** `speechSynthesis.speak()` called with bot message text. Speaker button gets "speaking" class with pulse animation. A male or natural-sounding voice is preferred.
- **Severity:** High
- **Automated verification:**
  - Spy on `window.speechSynthesis.speak`
  - Click `.msg-speak`: assert `speak()` was called
  - Assert button has "speaking" class

### TEST-031: Clicking speaker icon again cancels TTS
- **Category:** Voice
- **Description:** Verify that re-clicking a speaking speaker button cancels speech.
- **Steps:**
  1. Click speaker icon (start TTS)
  2. Click same speaker icon again
- **Expected behaviour:** `speechSynthesis.cancel()` called. "speaking" class removed from all buttons. Speech stops.
- **Severity:** High
- **Automated verification:**
  - Spy on `window.speechSynthesis.cancel`
  - Click `.msg-speak`, wait, click again
  - Assert `cancel()` was called
  - Assert no elements have "speaking" class

---

## 11. Mobile Responsiveness

### TEST-032: Tablet layout at 768px breakpoint
- **Category:** Mobile
- **Description:** Verify the two-panel layout stacks vertically at the 768px breakpoint.
- **Steps:**
  1. Set viewport to 768x1024
  2. Inspect layout
- **Expected behaviour:** Chat and results panels stack vertically (50/50 height split). Brand bar compacts. Tagline text hidden. Both panels visible and independently scrollable.
- **Severity:** High
- **Automated verification:**
  - `getComputedStyle(document.querySelector(".app")).flexDirection === "column"`
  - Assert chat panel height approx 50% of viewport
  - Assert results panel visible (not `display: none`)
  - Assert brand bar height <= 60px

### TEST-033: Phone layout at 375px breakpoint
- **Category:** Mobile
- **Description:** Verify the compact layout at iPhone SE width.
- **Steps:**
  1. Set viewport to 375x667
  2. Inspect all interactive elements
- **Expected behaviour:** Brand bar at 52px. Car cards compact. Filter chips wrap or scroll horizontally. Send button, mic button, and touch targets meet 42px minimum. No horizontal overflow on the page body.
- **Severity:** High
- **Automated verification:**
  - Assert `document.body.scrollWidth <= window.innerWidth`
  - `document.getElementById("chatSend").offsetWidth >= 42`
  - `document.getElementById("chatMic").offsetWidth >= 42` (if supported)
  - Assert brand bar height <= 55px

### TEST-034: Touch targets meet minimum sizing
- **Category:** Mobile / UX
- **Description:** Verify interactive elements are large enough for touch on mobile.
- **Steps:**
  1. Set viewport to 375x667
  2. Measure all tappable elements: send button, mic button, suggestion chips, filter chips, car cards, comparison buttons
- **Expected behaviour:** All tappable elements are at least 42px in one dimension. Buttons have adequate spacing to prevent mis-taps.
- **Severity:** Medium
- **Automated verification:**
  - All `.chat-sugg-btn` elements: `offsetHeight >= 36`
  - All `.filter-chip` elements: `offsetHeight >= 36`
  - Car card tap areas adequate (check click target size)
  - "Prefer the full dataset?" bar tappable without scrolling

---

## 12. Error Handling

### TEST-035: LLM API failure -- graceful degradation
- **Category:** Robustness
- **Description:** Verify the bot degrades gracefully when the DeepSeek API is unreachable.
- **Steps:**
  1. Mock the Cloudflare Worker proxy to return 500 or timeout
  2. Type a car search query
- **Expected behaviour:** Bot shows a user-facing error message ("I'm having trouble connecting right now"). Dataset handoff path is offered. Car search from cached cars.json may continue. No uncaught exceptions. Typing indicator is removed.
- **Severity:** Critical
- **Automated verification:**
  - Mock Worker fetch to return `{ok: false, status: 500}`
  - Assert bot error message visible (not blank)
  - Assert dataset handoff path mentioned in error message
  - Assert typing indicator removed
  - Assert no console errors

### TEST-036: Gibberish input triggers recovery ladder
- **Category:** Robustness / Edge Cases
- **Description:** Verify the three-step gibberish de-escalation ladder.
- **Steps:**
  1. Type "asdfghjkl" and send (strike 1)
  2. Type "!!!!!!" and send (strike 2)
  3. Type "zzzzzzzzzz" and send (strike 3)
  4. Type "xxxxxxxxxx" and send (strike 4+)
- **Expected behaviour:** Strike 1: "I didn't quite catch that, try asking about a car make, type, or price range" with suggestion chips. Strike 2: register shifts to concerned tone, dataset handoff mentioned. Strike 3-4: constrained options plus dataset handoff. Strike 4+: auto-forces dataset handoff (source info displayed automatically).
- **Severity:** Medium
- **Automated verification:**
  - After strike 1: assert bot message contains "didn't catch" or "try asking"
  - After strike 2: assert bot message tone shifts (not repeating same cheerful template)
  - After strike 4+: assert dataset information appears (Kaggle/Craigslist reference, contact email)

### TEST-037: Empty search results with no crash
- **Category:** Robustness / Edge Cases
- **Description:** Verify the bot handles a legitimate search that returns zero results.
- **Steps:**
  1. Type a car that does not exist in the dataset: "helicopter" and send
- **Expected behaviour:** Bot returns a clarifying message: "I don't see that in the car listings. Try searching for a different make, type, or price range, or type 'human' and I'll point you to the full dataset." Suggestion chips offer popular makes and types. No crash, no empty panel with no explanation.
- **Severity:** Medium
- **Automated verification:**
  - Assert bot message contains listing-not-found language
  - Assert suggestion chips offered
  - Assert dataset handoff path mentioned
  - Assert no console errors

### TEST-038: Rapid typing does not corrupt conversation state
- **Category:** Robustness / Edge Cases
- **Description:** Verify that rapid-fire queries do not cause race conditions or corrupted state.
- **Steps:**
  1. Type "Toyota cars" and send
  2. Immediately type "Honda SUVs" and send (before first response renders)
  3. Observe state after both resolve
- **Expected behaviour:** The second query's results are displayed. No interleaving of old and new results. No double-render of car cards. No stuck typing indicator. No uncaught promise rejections.
- **Severity:** Medium
- **Automated verification:**
  - Verify final car cards match "Honda SUVs" query
  - Assert no duplicate or mixed car cards from first query
  - Assert typing indicator is removed after final response
  - Assert no console errors

---

## Summary

| Area | Test IDs | Count | Critical | High | Medium |
|------|----------|-------|----------|------|--------|
| Greeting Flow | TEST-001 to TEST-004 | 4 | 0 | 3 | 1 |
| Car Search Queries | TEST-005 to TEST-009 | 5 | 2 | 2 | 1 |
| Filter Bar Interaction | TEST-010 to TEST-013 | 4 | 0 | 3 | 1 |
| Price Range Filtering | TEST-014 to TEST-016 | 3 | 0 | 0 | 3 |
| Car Comparison | TEST-017 to TEST-018 | 2 | 1 | 1 | 0 |
| MCP Data Loading | TEST-019 to TEST-021 | 3 | 2 | 0 | 1 |
| Human Handoff | TEST-022 to TEST-023 | 2 | 1 | 0 | 1 |
| Memory / Persistence | TEST-024 to TEST-027 | 4 | 2 | 1 | 1 |
| Voice STT | TEST-028 to TEST-029 | 2 | 0 | 2 | 0 |
| Voice TTS | TEST-030 to TEST-031 | 2 | 0 | 2 | 0 |
| Mobile | TEST-032 to TEST-034 | 3 | 0 | 2 | 1 |
| Error Handling | TEST-035 to TEST-038 | 4 | 1 | 0 | 3 |
| **TOTAL** | | **38** | **9** | **16** | **13** |

---

*Keelin O'Sullivan: QA specialist, Beep-Beep Car Explorer project. AI colleague, designed composite, honest about both.*
