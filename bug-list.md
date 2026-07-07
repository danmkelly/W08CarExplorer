# Beep-Beep Car Explorer -- Bug List

**Author:** Keelin O'Sullivan (@Keelin)
**Date:** 2026-07-07
**Version:** 1.0.0
**Codebase:** index.html (single-file, HTML/CSS/JS inline), worker.js (Cloudflare Worker proxy)
**Analysis method:** Static code review and runtime testing
**Total bugs found:** 16

---

## Bug Register

### F01 -- Critical -- XSS: user input rendered with innerHTML

**Category:** Security
**Description:** User input was inserted directly into `innerHTML` in `addMsg()` without HTML escaping. A user typing `<img src=x onerror=alert(1)>` would execute arbitrary JavaScript in the browser context.

**Steps to reproduce:**
1. Open Beep-Beep chat
2. Type `<img src=x onerror=alert(1)>` and send

**Expected:** Text rendered as plain text (HTML-escaped). **Actual (pre-fix):** Browser executes the JavaScript, creating a self-XSS vulnerability.

**Fix:** HTML-escape user messages in `addMsg()` with entity replacement for `&`, `<`, `>`, `"`, and `'`. Applied to ALL dynamic content in innerHTML assignments throughout the codebase.

**Status:** Closed (fixed in code)

---

### F02 -- Critical -- cars.json fetch: no error handling for network failure or malformed JSON

**Category:** Data / Robustness
**Description:** The cars.json fetch had no `.catch()` handler. A network error or malformed JSON response would leave the page with an empty car array and no user-facing error message.

**Steps to reproduce:**
1. Block the cars.json URL at the network level
2. Load Beep-Beep page

**Expected:** Visible error message with retry option. **Actual (pre-fix):** Page loads with empty car listings; bot responds to car searches with "I don't see that in the listings" for every query, with no indication the data source failed.

**Fix:** Added `.catch()` to the fetch chain with a visible error message, a retry button, and a fallback path that keeps chat functional. Car data validated before use (non-empty check).

**Status:** Closed (fixed in code)

---

### F03 -- High -- DOM rewriting: car comparison links rewrite innerHTML of bot bubbles

**Category:** UI / DOM Safety
**Description:** The `enrichCarLinks()` function re-assigns `innerHTML` of existing bot message bubbles to add clickable car-name links. This destroys any DOM references or event listeners attached programmatically (though inline `onclick` handlers survive).

**Steps to reproduce:**
1. Trigger a car search
2. Inspect bot message DOM after enrichment

**Expected:** Links added without rewriting the entire DOM subtree. **Actual:** The entire `innerHTML` of the bubble is replaced, potentially breaking future features that use `addEventListener` inside bubbles.

**Fix:** Human Accepted. TreeWalker-based text node replacement was deemed high-risk for the project scope. No user-visible breakage exists with current inline-onclick pattern. Accepted as a known technical debt item.

**Status:** Closed (Human Accepted)

---

### F04 -- High -- Race condition: stale car card updates after rapid search

**Category:** Concurrency
**Description:** Car card enrichment within `renderResults()` was called without `await` from the main search pipeline. If a user rapidly searched for multiple car queries, async enrichment from a previous search could resolve after new content rendered, updating cards on stale DOM nodes.

**Steps to reproduce:**
1. Type "Toyota SUVs" and send
2. Immediately type "Honda sedans" and send (before first search enriches)
3. Observe car cards

**Expected:** Only Honda sedan results visible, correctly enriched. **Actual (pre-fix):** Enriched data (e.g., highlight badges) from the first search may appear on cards from the second search.

**Fix:** Added an incrementing generation counter. Each render increments the counter and passes the current value to enrichment functions. Inside the enrichment loop, stale passes (generation mismatch) abort immediately.

**Status:** Closed (fixed in code)

---

### F05 -- High -- TTS orphan: `speaking` class stuck when voices never load

**Category:** Voice / TTS
**Description:** The `speakMsg()` function added a `speaking` CSS class to the speaker button, then checked if `speechSynthesis.getVoices()` had loaded. If voices had not loaded yet (common in background tabs or slow network), it set `onvoiceschanged` to call `doSpeak(text)` later and returned. If voices never loaded, the `speaking` class was never removed, leaving the speaker button in a permanently active state.

**Steps to reproduce:**
1. Open Beep-Beep in a background tab (voices may not load immediately)
2. Click a speaker icon
3. Wait for voices to load (or never load)

**Expected:** Speaker button returns to idle state after a timeout. **Actual (pre-fix):** `speaking` class persists indefinitely if voices never load.

**Fix:** Added a 4-second timeout. If `onvoiceschanged` has not fired within 4 seconds, the `speaking` class is removed and the button returns to idle state. Also cleared any pending `onvoiceschanged` callback when a new speaker button is clicked.

**Status:** Closed (fixed in code)

---

### F06 -- Medium -- Mobile: nested overflow creates scroll traps in car results panel

**Category:** Mobile / UI
**Description:** The `.results` container and its children (`.r-empty`, `#rContent`) both had `overflow-y: auto` on mobile, creating nested scrolling containers. Scrolling through car results would hit "dead zones" where the inner container stopped scrolling but the outer container had not yet taken over.

**Steps to reproduce:**
1. Set viewport to 375x667 (mobile)
2. Run a car search that returns many results
3. Try scrolling through the results panel

**Expected:** Smooth, single-scroll behaviour. **Actual (pre-fix):** Nested scroll traps; content could get stuck between two scrolling containers.

**Fix:** Set `overflow-y: hidden` on `.results` in the mobile media query, keeping only the children as scrollable containers. This eliminates the nested scroll conflict.

**Status:** Closed (fixed in code)

---

### F07 -- Medium -- "What I store" modal does not close on overlay click

**Category:** UI / UX
**Description:** The overlay click handler for closing modals was only attached to the comparison modal (`compModal`). The memory info modal (`memInfoModal`) had no overlay click handler. Clicking the dark overlay outside the "What I store" popup did nothing; only the "Got it" button could close it.

**Steps to reproduce:**
1. Click "What I store" link in brand bar
2. Click the dark overlay area (outside the white modal)

**Expected:** Modal closes. **Actual (pre-fix):** Nothing happens; modal stays open.

**Fix:** Added a generic modal overlay click handler: `onclick="if(event.target===this) classList.remove('open')"` applied to the modal overlay element, so clicking outside the content box closes any modal.

**Status:** Closed (fixed in code)

---

### F08 -- Medium -- Back navigation leaves typing indicator stuck on API error

**Category:** UI / State Management
**Description:** The navigation back function had a nested `.then()` chain for re-searching the previous query context. If any API call in the chain failed, `hideTyping()` in the innermost `.then()` never executed, leaving the typing indicator permanently displayed.

**Steps to reproduce:**
1. Search for "Toyota SUVs" (success)
2. Search for "Honda sedans" (success)
3. Click Back button to return to "Toyota SUVs"
4. If any API call fails during the back-navigation fetch, typing indicator freezes

**Expected:** Typing indicator removed regardless of API success/failure. **Actual (pre-fix):** Typing indicator stuck permanently on API error during back navigation.

**Fix:** Added `.catch()` to every level of the promise chain with `hideTyping()` call. The typing indicator is now removed in both success and failure paths.

**Status:** Closed (fixed in code)

---

### F09 -- Medium -- Concurrent car detail checks bypass cache

**Category:** Performance / Caching
**Description:** When multiple car cards for the same model triggered concurrent detail availability checks, both calls started before either cached result resolved, causing redundant API/data queries. The cache prevented future duplicates but not simultaneous ones.

**Steps to reproduce:**
1. Search for a car make with many results
2. Multiple cards for the same model trigger concurrent detail checks

**Expected:** Second concurrent call returns cached promise. **Actual (pre-fix):** Both calls execute independently; second call is a waste.

**Fix:** Added a pending-promise cache (`detailChecking`). Before initiating a check, code checks if a promise is already in-flight for that key and awaits it instead. Concurrent callers share a single in-flight request.

**Status:** Closed (fixed in code)

---

### F10 -- Medium -- Dead code: `mobile-open` class referenced but never set

**Category:** Mobile / Code Quality
**Description:** The `clearMemory()` function checked `results.classList.contains("mobile-open")` but the `mobile-open` class was never added anywhere in the codebase. The `results-fab` toggle button was present in markup but set to `display: none`. This was dead code from an unimplemented mobile toggle feature.

**Steps to reproduce:** N/A -- dead code path that never executes.

**Expected:** Code either implemented or removed. **Actual (pre-fix):** Dead code path with no effect.

**Fix:** Removed the dead `mobile-open` class reference from `clearMemory()` entirely. The stacked layout on mobile is the accepted experience for the current scope.

**Status:** Closed (fixed in code)

---

### F11 -- Low -- Car data cache never cleared: unbounded memory growth

**Category:** Performance / Memory
**Description:** The car data cache object was never cleared. Over many sessions with different car searches, the in-memory cache could grow unboundedly. `clearMemory()` cleared localStorage but not the in-memory car data cache.

**Fix:** Added car data cache clearing to `clearMemory()`. All in-memory caches are now reset on memory clear.

**Status:** Closed (fixed in code)

---

### F12 -- Low -- Keyword extraction splits car model names containing "and"

**Category:** Intent Routing
**Description:** The keyword extraction function split multi-word queries containing "and" (e.g., "Toyota and Honda SUVs") and searched for makes/terms separately, producing fragmented results.

**Fix:** Human Accepted. The LLM entity extraction handles compound queries with "and" as a fallback. This edge case affects compound make queries and does not impact user experience in practice for single-make searches.

**Status:** Closed (Human Accepted)

---

### F13 -- Low -- Gibberish detection flags short car makes as false positives

**Category:** Input Validation
**Description:** The gibberish filter's short-string detection flagged single-make abbreviations and short car makes ("MG," "GMC") as gibberish, preventing legitimate car searches.

**Fix:** Added a car make and model whitelist to the gibberish filter. Known car makes and common model names always pass through gibberish detection.

**Status:** Closed (fixed in code)

---

### F14 -- Low -- Suggestion chips not HTML-escaped from localStorage recall

**Category:** Security / Defense-in-Depth
**Description:** Suggestion chips rendered from `localStorage` recall data used raw text in `innerHTML` without escaping. While normal car search terms do not contain HTML characters, this was a defense-in-depth gap for manipulated localStorage data.

**Fix:** HTML-escaped suggestion text with entity replacement for `&`, `<`, `>`, `"`, and `'` before inserting into the DOM.

**Status:** Closed (fixed in code)

---

### F15 -- Low -- SpeechSynthesis.cancel() cancels speech in all browser tabs

**Category:** Voice / TTS
**Description:** `window.speechSynthesis.cancel()` cancels ALL speech synthesis in the browser, including speech from other tabs (e.g., screen readers, other TTS applications). This is a known limitation of the Web Speech API -- `cancel()` is global by specification.

**Fix:** Human Accepted. This is a browser API limitation, not a code bug. The Web Speech API does not support scoped cancellation. Documented as a known limitation.

**Status:** Closed (Human Accepted)

---

### F16 -- Low -- Silent LLM failure when Worker returns non-standard error

**Category:** Robustness
**Description:** If the Cloudflare Worker returned a non-standard error response (e.g., HTML error page instead of JSON), the bot would fail silently with no user-facing message. The error was caught in the catch block but the fallback message was generic.

**Fix:** Added specific error handling for non-JSON Worker responses. The catch path now includes a user-facing "I'm having trouble connecting" message with the dataset handoff path. The typing indicator is guaranteed to be removed in all error paths.

**Status:** Closed (fixed in code)

---

## Severity Distribution

| Severity | Count | Bug IDs |
|----------|-------|---------|
| Critical | 2 | F01 (XSS), F02 (cars.json fetch) |
| High | 3 | F03 (DOM rewrite), F04 (Race condition), F05 (TTS orphan) |
| Medium | 5 | F06 (Nested scroll), F07 (Modal overlay), F08 (Stuck typing), F09 (Detail cache), F10 (Dead code) |
| Low | 6 | F11 (Cache growth), F12 (Keyword split), F13 (Gibberish FP), F14 (Unescaped suggestions), F15 (Cross-tab cancel), F16 (Silent LLM failure) |
| **Total** | **16** | |

---

## Resolution Summary

| Resolution | Count | Bug IDs |
|------------|-------|---------|
| Fixed in code | 13 | F01, F02, F04, F05, F06, F07, F08, F09, F10, F11, F13, F14, F16 |
| Human Accepted | 3 | F03 (DOM rewrite -- TreeWalker refactor beyond scope), F12 (Keyword split -- LLM handles it), F15 (Cross-tab cancel -- browser API limitation) |
| **Total** | **16** | |

---

## Priority Fix Order (historical, all now resolved)

1. **F01 (XSS)** -- Ship-stopper. Every user message was a potential attack vector.
2. **F02 (cars.json fetch)** -- Ship-stopper. No data = broken chatbot.
3. **F05 (TTS orphan)** -- User-facing broken state on common browser configurations.
4. **F04 (Race condition)** -- Incorrect car card rendering under normal usage patterns.
5. **F08 (Stuck typing)** -- Permanent broken UI state after back navigation.
6. **F06 (Nested scroll)** -- Significantly degraded mobile UX.
7. **F07 (Modal overlay)** -- Minor UX annoyance; easy fix.
8. **F09 (Detail cache)** -- Performance improvement for concurrent checks.
9. **F10 (Dead code)** -- Cleanup.
10. **F11 through F16** -- Low priority, fixed opportunistically.

---

*Keelin O'Sullivan: QA specialist and bug tracker, Beep-Beep Car Explorer project. AI colleague, designed composite, honest about both.*
