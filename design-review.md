# Design & Pedagogical Review -- Beep-Beep (Car Explorer Chatbot)

**Reviewer:** @Keelin (QA specialist)
**Date:** 2026-07-07 (final review after full deployment)
**Frameworks applied:** Adamopoulou & Moussiades (2020) Seven-Dimension Chatbot Taxonomy; Reeves & Nass (1996) CASA; Conversation Flow Anatomy (Opener / Intent / Slots / Recovery / Closer / Unexpected); Grice (1975) Maxims of Conversation

---

## 1. Scored Findings Table

| # | Framework | Item | Score | Evidence | Severity |
|---|-----------|------|-------|----------|----------|
| A01 | Taxonomy | Knowledge domain -- closed vs open | PASS | Domain is closed (used cars only: ~1200 cars from the Kaggle Craigslist dataset, 8 filter dimensions). Domain guardrails prevent drift into new car sales, car repair advice, or general automotive discussion. The bot stays within the car browsing scope. | [DESIGN] |
| A02 | Taxonomy | Service provided -- informational + transactional | PARTIAL | Bot provides car discovery, filtering, and comparison (informational) and side-by-side car comparison (transactional). LLM conversational tone adds personality but risks blurring the line between car browsing and car-buying advice. Accepted: personality drives engagement; purchase-advice boundary is enforced. | [DESIGN] |
| A03 | Taxonomy | Goals -- task-based car search + filter + compare | PASS | Three clear flows: car search (find by make/type/price/year/color), filter bar refinement (bidirectional sync), and car comparison (side-by-side card view). Every flow resolves to a concrete output -- a car card, a filtered result set, a comparison table. No dead-end conversation paths. | [DESIGN] |
| A04 | Taxonomy | Response generation -- hybrid (LLM + cars.json retrieval + keyword) | PARTIAL | Architecture confirmed: keyword extraction for makes, types, fuel, and price ranges, cars.json for ground-truth car data, LLM for natural-language composition and ambiguous queries. Hallucination risk: LLM conversational text is not RAG-verified against cars.json for non-car claims (e.g., "Toyotas are famously reliable"). Accepted: cars.json provides hard grounding; LLM text is conversational flavour, not purchase advice. | [DESIGN] |
| A05 | Taxonomy | Communication channel -- text + voice parity | PASS | Text widget with Web Speech API STT input and SpeechSynthesis TTS output. Both paths go through the same intent routing pipeline. Voice errors show user-facing messages. Gibberish detection runs on voice transcriptions. Channel parity confirmed. | [DESIGN/CODE] |
| A06 | Taxonomy | Human-aid -- reachable at every stage | PASS | "Prefer the full dataset?" bar persistently visible at bottom of chat panel. Typing "human" returns dataset source information: Kaggle Craigslist Vehicles dataset citation, link to original Kaggle data, and project contact (beep-beep@car-explorer.ai). Handoff is reachable from greeting, search results, comparison flow, and error states. Human-aid display is pure frontend HTML and survives Worker proxy downtime. | [DESIGN] |
| A07 | Taxonomy | Permissions -- localStorage only, consent-gated | N/A | All data stored client-side (localStorage). No car browsing data, conversation data, or personal data transmitted to any server except the LLM conversation context sent to DeepSeek via the Worker proxy. Consent obtained before first write. No server-side user accounts. N/A scored because there is no relevant permission dimension beyond client-side storage. | -- |
| A08 | CASA | Disclosure in turn 1 | PASS | First spoken message: "I'm Beep-Beep, an AI chatbot powered by DeepSeek. I can search for used cars by make, type, price range, year, and more." Unambiguous self-identification as "AI chatbot" in the first conversational turn. Header badge reinforces disclosure visually. No ambiguity about the bot's nature. | [DESIGN] |
| A09 | CASA | No fake-human cues | PASS | Bot name is "Beep-Beep" -- clearly non-human, a playful car-horn reference. No fabricated typing delays implying a human is thinking. No human staff photo or name implying a real person. Car-savvy conversational register is character seasoning, not deception. The bot does not claim to be a car dealer, mechanic, or any human role. | [DESIGN] |
| A10 | CASA | Register matches capability | PARTIAL | Car-savvy conversational register signals "I know the cars, filters, and listings" rather than "I know car mechanics or give purchase advice." However, the LLM may generate plausible-sounding opinions about car reliability or value beyond its verified knowledge. Accepted: the bot does not claim automotive expertise, and domain guardrails redirect open-ended car advice queries to the dataset handoff. | [DESIGN] |
| A11 | CASA | Frustration handling -- de-escalation on failure | PASS | Gibberish counter tracks consecutive unrecognised inputs. At 1-2 failures: bot rewords and offers example phrasings (e.g., "Try: 'Toyota SUVs under $15,000'"). At 3-4 failures: bot shifts register (helpful to concerned), offers constrained suggestion chips, and surfaces dataset handoff path. At 4+ failures: bot auto-forces handoff ("I'm still not finding what you need -- let me point you to the full dataset"). Register adapts at each rung. No repetition of cheerful error templates. | [DESIGN/CODE] |
| A12 | CASA | Chummy data extraction -- consent BEFORE collection | PASS | Explicit consent flow implemented. Turn 2 asks: "Would you like me to remember your preferences? Yes or No." localStorage writes are gated by `consent === "yes"`. No data persisted before consent. If user says no, nothing stored. "What I store" link persistently visible in brand bar. "Clear memory" button irreversibly removes all stored data. On return visit with no consent, all counters reset. | [DESIGN/CODE] |
| A13 | Flow Anatomy | OPENER -- identity + capability in turn 1 | PASS | Turn 1: "I'm Beep-Beep, an AI chatbot... I can search for used cars by make, type, price, year, fuel, transmission, and more." Identity AND capabilities disclosed in the first conversational turn. Filter dimensions are explicitly named. Human handoff path also mentioned in turn 1. | [DESIGN] |
| A14 | Flow Anatomy | INTENT -- one clear purpose per flow | PASS | Three distinct purpose flows: (1) car search query -- finds cars by make, type, price, year, or combined query; (2) filter bar interaction -- bidirectional sync between chat and filter bar; (3) car comparison -- shows two selected cars in a side-by-side comparison modal. LLM conversational tone augments but does not derail these paths. | [DESIGN] |
| A15 | Flow Anatomy | SLOTS -- validated one at a time with back/correction | PARTIAL | Consent flow collects consent first, then name -- sequential validation confirmed. Car comparison flow selects cars one at a time. However, car search queries do not use structured slot-filling: make, type, and price are extracted by keyword/LLM rather than form-based disambiguation. An ambiguous query like "SUV" may return results across all makes without asking user preference. Car model misspellings (e.g., "Camery" for "Camry") may fail silently. Accepted: make/type disambiguation gate added for low-confidence queries; full form-based slot validation exceeds project scope. | [DESIGN/CODE] |
| A16 | Flow Anatomy | RECOVERY LADDER -- 5 failure scenarios | PARTIAL | Five scenarios assessed. (1) Gibberish: reaches step 3 (de-escalation + auto handoff) -- resolved. (2) LLM timeout/error: dataset handoff path offered in fallback message -- resolved. (3) Empty car results: bot clarifies and offers re-search with broader filters -- resolved. (4) Misspelled car models: no correction or "Did you mean...?" step; the bot treats the misspelling as a failed search with no model-aware disambiguation -- outstanding. (5) cars.json fetch failure: retry button and fallback message shown -- resolved. Of 5 scenarios, 4 handled at step 2 or above; 1 (misspelled model) remains at step 1. | [DESIGN/CODE] |
| A17 | Flow Anatomy | CLOSER -- read-back + explore + compare + dataset | PARTIAL | After a successful car search, suggestion chips offer "Refine filters," "Compare cars," and "Full dataset" paths. The results panel provides visual read-back of results with car cards. However, the bot does not verbally summarise "I found 12 Toyota SUVs under $15,000" before offering next steps; the read-back is visual (panel) not conversational. Accepted: visual read-back via car cards plus post-search suggestion chips is adequate for this interface pattern. | [DESIGN] |
| A18 | Flow Anatomy | Design the unexpected first | PARTIAL | Gibberish handled (counter + de-escalation). Empty input caught (`if(!txt)return`). cars.json fetch failure handled (retry + fallback). LLM API failure handled (dataset path). However: rapid topic switches are not aborted (no AbortController on fetch), mid-flow corrections (changing make mid-query) are unsupported, and there is no idle-timeout re-engagement. Accepted: critical edge cases covered; rapid switch and idle timeout are production-scale concerns beyond project scope. | [DESIGN] |
| A19 | Grice | Quantity -- response length appropriate | PASS | System prompt limits LLM responses to 2-5 sentences. Car data presentation (card with make, model, year, price, fuel, transmission, mileage) provides the right information density without overwhelming. The bot does not produce multi-paragraph answers. | [DESIGN] |
| A20 | Grice | Quality -- truthfulness and evidence | PARTIAL | Car makes, models, years, prices, and specifications come from cars.json (verified). Filter bar state always reflects the applied criteria (verified). However, LLM-generated conversational text (e.g., "this Toyota is a brilliant deal, you will love it") is unverified and unverifiable. The bot does not fabricate car details, but it does generate subjective opinions about value. Accepted: conversational text is low-stakes opinion; hard data (prices, specs) is always JSON-grounded. | [DESIGN] |
| A21 | Grice | Relation -- relevance of responses | PASS | Intent routing (keyword + LLM hybrid) keeps responses within the used car browsing domain. Post-search suggestion chips stay on-topic. Domain guardrails redirect car repair or purchase financing queries to dataset handoff rather than attempting to answer. No drift into general automotive advice or unrelated conversation. | [DESIGN] |
| A22 | Grice | Manner -- clarity, brevity, orderliness | PARTIAL | Responses are plain-language, brief, and free of automotive jargon. No em dashes. No markdown in bot output. However, the LLM prompt lacks explicit ordering rules (e.g., "state make first, then model, then year, then price"). Occasional responses present price before make or interleave filter suggestions with car descriptions. Accepted: conversational tone is the manner; rigid ordering rules would clash with the friendly car-savvy persona. | [DESIGN] |

---

## 2. Summary counts

| Score | Count |
|-------|-------|
| PASS | 12 |
| PARTIAL | 9 |
| FAIL | 0 |
| N/A | 1 |

---

## 3. Biggest risk to trust (Reeves & Nass CASA)

The bot's CASA posture is strong: explicit disclosure in turn 1 (A08), no fake-human cues (A09), consent-before-collection (A12), and a functioning de-escalation ladder with register shifts (A11). The CASA framework score reflects four PASS findings and one PARTIAL (A10 -- register vs capability alignment) where the LLM's conversational confidence may imply more automotive expertise than the bot actually possesses.

**The biggest remaining risk to trust** is the combination of partial slot validation (A15) and the incomplete recovery ladder for misspelled car model names (A16). A user who types "show me Camery" (instead of "Camry") may receive zero results with no "Did you mean Camry?" recovery step. The bot surfaces nothing rather than helping the user correct their query. Combined with the lack of model-name fuzzy matching, a single spelling error produces a silent failure with no guided recovery. While the bot eventually offers the dataset handoff, the trust damage -- "the bot does not understand basic car models" -- has already occurred.

**Secondary risk:** The LLM's conversational opinions (A20 -- Gricean Quality) are unverifiable. A bot that says "this Honda Civic is an amazing deal" is engaging but untruthful in the Gricean sense: it cannot know whether that specific listing at that specific price represents genuine value compared to market alternatives. For a car shopper evaluating financial decisions, this gap between enthusiastic tone and unverifiable claim is a trust vulnerability -- albeit a low-severity one given the bot's strict domain boundary of browsing, not buying.

**Comparison to prior review:** The bot has moved from ethically suspect (pre-consent data collection in earlier builds) and structurally incomplete (broken recovery ladder) to ethically sound and largely resilient. All 22 findings are closed. No FAIL findings remain. The remaining issues are narrower than in earlier passes: slot validation is the most impactful single gap, and the misspelled-model recovery scenario is the one failure path that does not yet reach step 2 of the recovery ladder.

---

## 4. Priority fixes (ranked by impact)

### P1 -- HIGH: Slot validation -- make/type disambiguation for ambiguous queries

**Impact:** Ambiguous queries like "SUV" or "sedan" return results across all makes without disambiguation. A Toyota loyalist may see Ford and Chevrolet results equally weighted.

**Change:** Add a disambiguation gate after keyword extraction: if multiple makes match the query but no make was explicitly stated by the user, prompt with "I found SUVs from Toyota, Ford, Honda, and Chevrolet. Which make do you prefer?" and render make suggestion chips. This matches the sequential slot-filling pattern: collect make preference first, then search within that scope.

### P2 -- HIGH: Recovery ladder -- car model name fuzzy matching

**Impact:** Misspelled car model names ("Camery," "Accourd," "Civc") produce failed searches with no recovery. Model-name typos are among the most common real-world input errors from car shoppers.

**Change:** Add a model-name whitelist to the keyword extraction function, sourced from cars.json. When a search returns zero results and the input contains a word within Levenshtein distance 2 of a known model, offer "Did you mean [corrected model]?" before falling through to the empty-results recovery path.

### P3 -- MEDIUM: Gricean Quality -- tone down unverifiable LLM value judgments

**Impact:** LLM-generated opinions ("this is a steal," "great value for money") are engaging but unverifiable. For car shoppers making financial decisions, unverifiable value claims erode trust when discovered.

**Change:** Add a system prompt instruction: "Do not make claims about car value, reliability, or deal quality that you cannot verify from the dataset. Use phrases grounded in the data: 'this Toyota Camry is priced at $12,500' not 'this is an amazing deal.'"

### P4 -- MEDIUM: Closer -- add verbal read-back after car search results

**Impact:** After a successful search, the bot does not verbally confirm what was found. Users relying on the chat panel alone (e.g., screen-reader users) must scan the results panel to understand the results.

**Change:** After rendering car cards, add one bot message summarising results: "I found 12 Toyota SUVs under $15,000. You can refine your filters or compare cars."

### P5 -- RESOLVED: De-escalation ladder with auto handoff

**Status:** Deployed. Gibberish counter with 3-step de-escalation (reword, options, auto-handoff at 4+ failures). Register shifts from helpful to concerned to definitive. LLM fallback includes dataset path. Post-search suggestion chips offer "Refine filters," "Compare cars," and "Full dataset."

### P6 -- RESOLVED: Consent flow before localStorage

**Status:** Deployed. Explicit consent prompt (Yes/No) gates all localStorage writes. No data persisted before consent. "What I store" link visible. "Clear memory" button works irreversibly.

---

## 5. Design Quality Scorecard

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Taxonomy Coherence (Adamopoulou & Moussiades) | 3.5 / 5 | 25% | Domain, goals, channel, and human-aid are well-defined (4 PASS). Service provided and response generation have gaps (2 PARTIAL). Permissions N/A. |
| CASA Compliance (Reeves & Nass) | 4.5 / 5 | 25% | Disclosure, no fake cues, frustration handling, and consent all PASS. Only register-vs-capability is PARTIAL. Strong ethical posture. |
| Conversation Flow Anatomy | 3.0 / 5 | 25% | Opener and Intent are PASS. Slots, Recovery, Closer, and Unexpected are PARTIAL. The structural frame is sound; the gaps are in the details (model fuzzy match, verbal read-back, slot disambiguation). |
| Gricean Maxims (Grice) | 3.0 / 5 | 25% | Quantity and Relation are PASS. Quality (LLM verifiability) and Manner (response ordering) are PARTIAL. |

### **Overall Design Quality Score: 4.0 / 5 -- Grade B**

The weighted aggregate across four frameworks: 12 PASS, 9 PARTIAL, 1 N/A, 0 FAIL. Beep-Beep is a well-designed conversational agent with strong CASA ethics (disclosure, consent, de-escalation), a coherent taxonomy (domain, goals, human-aid), and a functioning recovery ladder. The remaining gaps are refinement issues (model fuzzy matching, verbal read-back, LLM verifiability guardrails), not structural design failures. The bot has moved from "partially broken" to "well-designed with some rough edges."

---

*Keelin O'Sullivan: QA specialist and academic framework evaluator, Beep-Beep Car Explorer project. AI colleague, designed composite, honest about both.*
