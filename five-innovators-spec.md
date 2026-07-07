# Beep-Beep Car Explorer: design specification

> **Team:** The Five Innovators at Beep-Beep Car Explorer
> **Client:** Car shoppers browsing the used car market
> **Brief:** Build a customer-facing AI chatbot ("Beep-Beep") that helps users browse ~1200 used cars using live MCP data from a preprocessed Kaggle Craigslist dataset, powered by DeepSeek LLM, delivered in the browser.

---

## Project overview

Beep-Beep Car Explorer is an AI-powered conversational car browsing experience. It helps users search, filter, and compare ~1200 used cars drawn from Kaggle's Craigslist Vehicles dataset, which originally contained 447K rows and was preprocessed to a curated subset of 1200 cars for responsive in-browser operation. The chatbot lets users describe the car they want in natural language and instantly see matching results.

Beep-Beep is powered by DeepSeek LLM, runs entirely in the browser, fetches live car data from a local `cars.json` file (the MCP pattern: live data as the single source of truth), routes LLM calls through a Cloudflare Worker proxy for API key security, and persists personalisation data in localStorage with explicit consent. The interface uses a two-panel layout: chat on the left, car results with a filter bar on the right, with bidirectional synchronisation between the two.

---

## Team structure

| Innovator | Handle | Role | Domain ownership |
|-----------|--------|------|-----------------|
| Cormac Quinn | `@Cormac` | Manager / Orchestrator | Task decomposition, specialist dispatch, quality gates, cross-framework synthesis, delivery management |
| Fionn Grogan | `@Fionn` | Researcher / Domain Expert | Used car market research, taxonomy building, intent-to-filter mapping, domain boundary enforcement |
| Siobhan O'Curran | `@Siobhan` | Designer | Conversational UI design, car card layout, two-panel widget, filter bar design, brand visual identity, mobile responsiveness |
| Dara Bostwick | `@Dot` | Maker / Engineer | Chatbot conversation engine, MCP integration (cars.json pipeline), intent routing (keyword + LLM hybrid), car comparison flow, localStorage memory, voice STT/TTS, recovery ladder |
| Niamh O'Brien | `@Niamh` | Backend / Infrastructure | Cloudflare Worker proxy for DeepSeek API key, CORS configuration, secrets management, GitHub Pages deployment, environment security |
| Keelin O'Sullivan | `@Keelin` | QA / Evaluator | Test plan design, bug tracking and triage, academic framework scoring (Taxonomy, CASA, Flow Anatomy, Grice), regression testing |

The scopes are non-overlapping: Fionn never builds, Siobhan never writes conversation logic, Dot never deploys infrastructure, Niamh never designs interfaces, Keelin never modifies features, and Cormac never does specialist work.

---

## Technical architecture

```
Browser (index.html)
  |-- cars.json (MCP live data, preprocessed Kaggle Craigslist dataset, 1200 cars)
  |-- Cloudflare Worker proxy (/api/chat)
  |     `-- DeepSeek LLM (api.deepseek.com, key never in browser)
  |-- localStorage (consent-gated: name, visit count, search history, preferred makes)
  |-- Web Speech API (STT) and SpeechSynthesis API (TTS)
  `-- GitHub Pages (static hosting)
```

The architecture separates authenticated calls (DeepSeek LLM, through the Worker proxy) from unauthenticated calls (cars.json, served as a static asset). The Worker is a lightweight script that accepts POST requests from the browser, attaches the DeepSeek API key from `env.LLM_KEY`, forwards to `api.deepseek.com`, and returns the response. No key ever enters the browser.

---

## Key features

1. **MCP live data integration:** The bot reads `cars.json` at runtime. Every car surfaced (make, model, year, price, fuel, transmission, type, color, drive, mileage) comes from the live data. No stale embedded data. The original 447K-row Kaggle Craigslist dataset was preprocessed to 1200 representative cars for fast in-browser filtering.

2. **Two-stage intent routing:** Keyword extraction catches car makes, types, fuel types, and price ranges for fast high-confidence matches. The LLM handles ambiguous, conversational, or compound queries as a second-stage disambiguator.

3. **Car search with bidirectional filter sync:** Users can search by make ("Toyota"), type ("SUV"), price range ("under 15,000"), year ("2018 or newer"), or combined queries ("red Toyota SUVs under 20,000"). Car cards render in the results panel with make, model, year, price, fuel, transmission, mileage, and color. The filter bar (price, year, manufacturer, fuel, transmission, type, color, drive) stays in sync: typing in chat updates the filter bar, and changing filters updates the chat context.

4. **Car comparison flow:** A comparison modal lets users select two cars and see a side-by-side comparison table with key attributes: price, year, mileage, fuel economy, transmission, and condition. The comparison is triggered from chat or by clicking car cards.

5. **Voice input/output:** Web Speech API for STT (microphone button with listening state animation) and SpeechSynthesis for TTS (speaker icon on each bot message, cancel on re-click, auto-speak after voice input).

6. **Memory and personalisation:** localStorage stores user name, visit count, search history, and preferred car makes -- all gated by an explicit consent flow (Yes/No prompt before any write). A "What I store" link and "Clear memory" button give full transparency and control.

7. **Recovery ladder:** A gibberish counter tracks consecutive unrecognised inputs. At failures 1-2 the bot rewords the question. At failures 3-4 it offers constrained suggestion chips and the human handoff path. At failure 4+ it auto-forces human handoff. Register shifts from helpful to concerned to definitive.

8. **Human handoff:** The "Prefer the full dataset?" bar is persistently visible at the bottom of the chat panel. Typing "human" returns dataset source information: the Kaggle Craigslist Vehicles dataset citation, a link to the original Kaggle dataset, and the project contact (beep-beep@car-explorer.ai).

---

## Academic frameworks applied

Four frameworks from the Customer Engagement and AI module are embedded in the chatbot's design, build, and evaluation:

| Framework | Source | Application | Domain owner |
|-----------|--------|-------------|-------------|
| Seven-Dimension Chatbot Taxonomy | Adamopoulou & Moussiades (2020) | Quality-gate checklist: knowledge domain, service provided, goals, response generation, channel, human-aid, permissions | Fionn (domain, service scope); Dot (goals, response gen, channel); Niamh (human-aid, permissions); Siobhan (channel presentation) |
| CASA (Computers Are Social Actors) | Reeves & Nass (1996) | Trust and ethics guardrail: disclosure, fake-human cues, register, frustration handling, chummy data extraction | Siobhan (disclosure design); Dot (frustration handling); Niamh (data governance); Fionn (register alignment); Keelin (CASA audit) |
| Conversation Flow Anatomy | Adamopoulou & Moussiades (2020) | Structural completeness: Opener, Intent, Slots, Recovery, Closer, Unexpected | Dot (recovery ladder, intents, slots); Siobhan (opener/closer UI); Cormac ("design the unexpected first" as sprint rule) |
| Gricean Maxims | Grice (1975) | Conversation quality: Quantity, Quality, Relation, Manner | Dot (Quantity, Quality -- response length and LLM grounding); Fionn (Relation -- domain guardrails); Siobhan (Manner -- clarity and brevity in UI) |

Keelin owns the cross-framework scoring rubric and produces a weighted design score from 22 academic findings (A01-A22).

---

## Design principles

1. **Conversational-first:** Users describe the car they want naturally. The bot understands "I need a reliable family SUV under $20k" without requiring form-filling. The filter bar complements the conversation; it does not replace it.

2. **Filter-transparency:** Every filter change is reflected in the chat, and every chat query updates the filters. Users always know what criteria are applied. No hidden filter state.

3. **Recovery-first:** Failure paths are designed and scheduled before happy paths. Every phase plan starts with "what happens when cars.json fails to load?" and "what happens when the user types gibberish four times?"

4. **Mobile-responsive:** The two-panel layout (chat left, results right) stacks vertically at 768px. Touch targets meet a 42px minimum. The results panel scrolls independently on mobile. Filter chips and car cards are thumb-friendly.

5. **Live data as truth:** `cars.json` is the single source of truth. Every car surfaced by the bot must match the live data exactly. The bot does not hallucinate car prices, makes, or specifications.

6. **Human-always-reachable:** The handoff path (dataset link, project contact) is available from every conversational state, including error states and proxy failure -- the handoff display is pure frontend HTML and survives Worker downtime.

---

## Delivery pattern

Cormac runs the following handoff sequence:

```
Fionn (car market research + domain boundary)
  -> Siobhan (interface design + car cards + filter bar)
    -> Dot (conversation engine + MCP pipeline + comparison + voice)
      -> Niamh (Cloudflare Worker proxy + secrets + deployment)
        -> Keelin (test plan + bug register + academic scoring)
          -> Cormac (synthesis + final deliverable)
```

Each handoff includes a contract: input (what the specialist receives), output format (what they deliver), success criteria (how it is judged), and handoff destination (who receives it next). Quality gates are mandatory at every stage.

---

## Data source

- **Dataset:** Kaggle Craigslist Vehicles dataset (original: 447K rows)
- **Preprocessed:** Curated to ~1200 cars, deduplicated, normalised fields
- **Fields:** make, model, year, price, fuel, transmission, type, color, drive, mileage, condition, description
- **Filter dimensions:** price, year, manufacturer, fuel, transmission, type, color, drive

---

*Beep-Beep Car Explorer: designed and delivered by the Five Innovators team for the Customer Engagement and Artificial Intelligence module.*
