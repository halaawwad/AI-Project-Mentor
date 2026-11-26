# AiPM · AI Project Mentor

AiPM helps students learn electronics through their own project. This hackathon prototype is a
client-only app that connects **project descriptions with AI part suggestions**, a **component
catalog**, a **bill of materials (BOM)** and a **3D virtual hardware lab**.

The catalog, BOM and lab screens are migrated from the student app of
[LabAssist](https://github.com/halaawwad/LabAssist) (`frontend/student`). Part suggestions call the
Google Gemini API (free tier) directly from the browser when a key is configured. There is no
backend or account.

## Run locally

Requires Node.js 22 or newer and npm.

```bash
npm install
npm run dev        # http://localhost:8080
```

### Gemini API key (optional)

Without a key, **Describe your project** uses the local demo engine and labels its results
"Demo suggestions (local)". To use Gemini, create a free key in Google AI Studio, then:

```bash
cp .env.example .env.local     # Windows PowerShell: Copy-Item .env.example .env.local
```

Then edit `.env.local`:

```
VITE_GEMINI_API_KEY=<your key>
VITE_GEMINI_MODEL=               # optional, defaults to gemini-3.5-flash
```

Restart `npm run dev` after changing it. `.env.local` is git-ignored.

> **Security:** `VITE_` variables are compiled into the browser JavaScript, so anyone who can open
> the app can read the key. This is accepted for this private prototype only. Use a dedicated
> free-tier key and revoke it after the demo. Don't deploy a build made with a real key to a public
> URL. `npm run build` with `.env.local` present writes the key into `dist/`.

Other scripts:

```bash
npm run typecheck  # TypeScript, no emit
npm test           # Vitest (lab, wiring rules, journey, quizzes, mentor; Gemini is always mocked)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## What's included

| Screen | Route | Notes |
| --- | --- | --- |
| Home | `/` | Two entry points ("I have a project idea", "I don't have an idea yet"), continue journey, **Reset demo** |
| Learning journey | `/journey`, `/journey/choose`, `/journey/level`, `/journey/stage?id=`, `/journey/ready` | Choose a learning project or continue from approved parts, take a level check, then follow gated stages. Each stage has a lesson, its parts (View in 3D / Practice in 3D Lab) and a quiz; pass with 80% to unlock the next. A failed quiz shows mentor feedback and a second quiz version. Ends with "Ready to build your project" |
| New component | `/journey/new-component` | Enter a part name: catalog parts open their catalog page; other parts get Gemini information labelled "AI information — verify with the datasheet". No datasheet links or 3D models ("3D model: not available yet"); external 3D search stays "Coming soon" |
| Demo readiness | `/demo-readiness` | Which AI results the scripted demo needs (traffic light), which are cached, **Prepare missing** and **Clear AI cache** |
| Describe your project | `/describe` | Describe a project in Arabic or English, or pick an example. Suggested parts come with a summary, quantity, role and reason. Review them, edit quantities, add or remove parts, then **Approve list** to add them to the BOM |
| Component Catalog | `/catalog` | 43 parts in 8 categories. Category workbench with a 3D preview, a searchable library (English/Arabic) filtered by category and supply voltage, details with pins, connection sheets and original datasheet links. `?part=<key>` opens one part's details |
| Bill of Materials | `/bom` | Parts added from the catalog, with quantities. Saved in `localStorage` |
| 3D Lab | `/lab` | Place, move, rotate and wire parts. Choose wire types, validate wiring with rules, undo/redo, save circuits and versions. `?add=<model>&request=<id>` places a part |

### Local data

| Key | Contents |
| --- | --- |
| `aipm.bom.v1` | `[{ key, quantity }]` BOM entries (catalog keys) |
| `aipm.lab.project.v1` | Lab project: circuits, parts, wires and saved versions |
| `aipm.journey.v1` | The learner's journey: progress, profile (mastery, answer records, cached quizzes) and the cached mentor analysis and plan |
| `aipm.ai.cache.v1` | Validated Gemini results per feature, checkpoint and language (kept by Reset demo) |

If saved data can't be read, AiPM leaves it untouched and shows a notice. The notice lets you
retry or explicitly reset the unreadable data. Lab parts with unknown types and wires pointing at
missing pins are dropped when a project is loaded.

### Part suggestions

All suggestions go through `suggestParts(description)` in `src/lib/suggest/index.ts`:

- **AI suggestions** (key set): the description and a compact catalog list go to Gemini
  (`@google/genai`, `generateContent`) as one request per submit, with no automatic retries. The
  request uses JSON output with a response schema whose part `key` is an enum of the catalog keys.
  The response is then validated again in code. Unknown keys, invalid quantities and malformed
  items are dropped, and duplicates are merged. Results are labelled "AI suggestions" and should
  be reviewed.
- **Demo suggestions (local)**: used when there's no key or the call fails. That covers:
  - the free limit being reached (429)
  - an invalid key
  - a model that isn't found (404)
  - the service being unavailable (503) or another server error
  - the network
  - a timeout after 90 s
  - a blocked or empty answer, or an unusable response

  The page says why, in Arabic and English. Example projects return curated local results; other
  text uses keyword matching.

### Gemini request settings (all structured calls)

- One function, `generateStructured` in `src/lib/suggest/aiEngine.ts`, makes every request
  (suggestions, level, plan, lessons, quizzes, feedback, wiring help, components). It sends one
  request with structured JSON output and no retries.
- **Thinking is set to the lowest level each model supports** (`thinkingConfigFor`): Gemini 3 and
  later use `thinkingLevel` (MINIMAL for Flash and Flash-Lite, LOW for Pro); Gemini 2.5 uses
  `thinkingBudget` (0 for Flash, 128 for Pro); older models get none.
- The timeout is 90 s. Every waiting state shows "Still working…" after 15 s.
- Prompts carry only the stage's and project's part data, never the full catalog. Controller boards
  list pin names only. Answer history is limited to the last 12 records and few-shot examples to
  2–3 short lines. Part suggestions are the exception: they choose from the whole catalog, so they
  still send the compact catalog list.
- Every call is logged with feature, model, duration, result and HTTP status, never the key
  (error details are redacted). The log appears on the Demo readiness screen and, in development,
  in the browser console as `[AiPM Gemini] …`.

### Personalized quizzes (phase 5)

- **Learner profile** (inside the journey): mastery per skill (0–100, updated after
  every quiz from the skill tags of right and wrong answers), current difficulty (easy, medium or
  hard, set from the level check), and per-stage history: questions asked, wrong answers,
  attempts, and the cached next quiz.
- **Adaptive rules** (`src/lib/journey/adaptive.ts`, deterministic):
  - Below 80%: the next quiz focuses on the missed skills. It's one step easier if the score was
    below 50%, otherwise the same difficulty.
  - 80–99%: the next stage's first quiz adds 1–2 review questions on the weakest skill so far.
  - 100% on the first try: difficulty goes up one step.
  - Questions already asked in a stage are reused only when no alternatives remain.
- **Gemini** (`aiQuiz.ts`): one request per quiz, no retries. It sends the stage lesson, part pin
  data, the profile, recent wrong answers and the already-asked questions. It receives a
  personalized explanation, a practice task and 5 questions.
- **Strict validation:** the whole quiz is rejected unless every question has 4 distinct options,
  one correct index, a known skill and difficulty, and no duplicate or previously asked prompt.
  It must also cover the plan's focus and review skills and mention no part outside the provided
  data. Prepared quizzes are cached, so a reload doesn't send another request.
- **Local fallback** (no key, offline, free limit, errors, invalid answer): the same plan selects
  from each stage's 14-question skill- and difficulty-tagged bank, with the prewritten explanation
  for the weakest skill.
- **Labels:** "AI-generated for you" (Gemini) or "Selected for you from local content". Each quiz
  starts with a "Why this quiz" card. The path page shows mastery bars and the current difficulty.
- **One learner:** AiPM has a single learner per browser, like a real student. Personalization is
  shown live by answering differently. Data from the earlier two-learner demo is migrated once on
  load: Student A's journey, profile, answer records and AI cache are kept, and Student B's data is
  removed. Invalid or partial old data is sanitized or left untouched, never crashing the app.
- **Language:** Arabic (RTL) by default, with technical terms and pin names kept in English. The
  Arabic/English toggle is in the header of every journey screen. All local content (lessons, the
  full question bank, level check, mentor text, practice tasks, generated paths, skill names) is
  written in both languages.

### Mentor analysis and personalized plan (phase 6)

- **Answer records** (`profile.answers`, newest 40): for every level-check and quiz answer, the
  question, the chosen option, the correct option, the skill tag, the difficulty and the source.
- **One Gemini request per checkpoint** (`mentorAi.ts`): right after the level check and after each
  completed stage, diagnosis and plan come back together in one structured-JSON request, with no
  retries. The request contains the project parts, the path's stages with their skills,
  prerequisites and status, mastery per skill, the level, the last 20 answer records and the
  previous plan. Results are cached per checkpoint and language, so reloads and practice quizzes
  don't send another request. A language switch sends one request for the new language. **Try
  Gemini again** sends one request, and only when you click it.
- **Diagnosis:** strengths, weak skills, likely misconceptions in plain language (from the wrong
  option the learner chose) and a confidence note. Confidence must be "low" with fewer than 6
  answers.
- **Plan:** every stage in order with an action (keep, shorten, skippable) and a reason, plus up to
  three remedial mini-lessons for weak skills (local skill notes plus Gemini's personalized
  explanation).
- **Local validation** (`validateDiagnosis`, `validatePlan`) repairs what is safe to repair. A
  repaired result is still labelled "AI analysis" / "AI-personalized plan". Repairs:
  - strengths, weak skills and misconceptions without supporting answers (or in the wrong
    language) are dropped
  - a skill listed as both strong and weak stays weak only
  - confidence is forced to "low" below 6 answers
  - overlong text is trimmed, and a missing summary, note, reason or change note gets a short
    default
  - missing stages are added as "keep"
  - the order is fixed to respect the prerequisites in `path.ts`, with completed and attempted
    stages first (or the order already chosen at this checkpoint, for a second language)
  - completed stages and invalid actions become "keep", and "skippable" on a stage with a weak
    skill becomes "keep"
  - remedials for skills that aren't weak or taught in the path, duplicates and items past three
    are dropped; a remedial placed before a completed stage moves to the first open stage
- **Still rejected** (then the local rules are used): unknown stage IDs or skill tags, links, a
  summary in the wrong language, text naming a part outside the project, or nothing usable left.
  The exact rules that rejected an answer, or the repairs applied, appear in the Demo readiness
  call log and in the dev console. Neither the key nor the prompt is logged.
- **Lessons** are repaired the same way: overlong fields are trimmed at a sentence end, and a
  missing goal or analogy, or a practice task without a real pin name, is replaced by the
  prewritten text. The stage page then says which parts came from local content. A missing or
  too-short explanation, the wrong language, a link or a foreign part still rejects the lesson.
- **Gating is unchanged:** grading, the 80% pass mark and stage locking stay local. *Skippable*
  only lets you skip the lesson; the stage opens in order and passes only with 80% on its quiz.
  *Shorten* shows a short lesson with a "Show the full lesson" button. Mini-lessons are reading
  and never lock anything.
- **Fallback** (no key, offline, free limit, errors, invalid answer) is labelled "Based on local
  rules". It uses a rule-based diagnosis from the answer records:
  - weak: a recent wrong answer, and either the latest answer on that skill was wrong or mastery
    is below 50
  - strong: the latest answer was right and at most a quarter were wrong
  - "Recent mistakes" instead of misconceptions
  - the unchanged path plus a mini-lesson for up to two weak skills
  - local rules never shorten or skip a stage
- **Labels:** AI output is labelled "AI analysis" and "AI-personalized plan".
- **Where it shows:**
  - The path page has a "Mentor analysis" panel, a "What changed and why" note (Gemini's note
    plus the computed differences) and the **Your plan** list with Added, Shortened and Skippable
    badges and a reason for each item.
  - After a passed quiz, the stage page shows the updated analysis.
  - After a failed quiz, the stage page shows the AI feedback on each wrong answer (see below);
    the analysis and plan update when the stage is completed.
- **Quizzes:** the latest diagnosis (weak skills and misconceptions) is added to the Gemini quiz
  request, so questions target them.

### AI mentor features and demo cache (phase 7)

Each feature makes one Gemini request per action, using structured JSON and no retries. The
result is checked by strict local validation, and the existing rules or content are the
fallback. Labels: "AI-generated" (also when cached) and "Local content" / "Based on local
rules", with the reason Gemini wasn't used and a one-request "Try Gemini again".

| Feature | Where | Validation | Fallback |
| --- | --- | --- | --- |
| Level check (`levelAi.ts`) | "See my level" | level and difficulty from the allowed values, at most one step from the rules, a reason in the selected language | score thresholds |
| Lessons (`lessonAi.ts`) | each stage (goal, explanation, analogy, practice task) | length limits, language, no links, only project and stage parts, a practice task with a real pin name | prewritten or catalog-generated lesson |
| Failed-quiz feedback (`feedbackAi.ts`) | after a failed quiz | exactly one likely misconception per wrong answer (from the chosen option), language, part names | rule-based feedback with the known misconception |
| Stage order | plan (see phase 6) | declared prerequisites, completed or attempted stages stay first | current order |
| Wiring help (`lib/lab/wiringAi.ts`) | 3D Lab, "Explain with mentor" after Validate Wiring | one note per rule result, language, only circuit and project parts; the circuit is never changed | the existing rule messages plus a fix hint per rule |
| New component (`componentAi.ts`) | New component screen | pins, voltage, use, project fit and safety notes; no links | catalog data for catalog parts, otherwise "no information" |

**Demo cache** (`src/lib/ai/cache.ts`):

- Every validated result is stored in `aipm.ai.cache.v1` and checked again before reuse.
- The cache is used before any request, even without a key, so a prepared demo also runs offline.
- Reset demo keeps it; **Clear AI cache** on the Demo readiness screen removes it.
- The Demo readiness screen walks the scripted demo (`src/lib/ai/demo.ts`): 11 results. It prepares missing results one request at a time, with a 4-second pause,
  and stops at the free limit or a key problem.

### Learning data (local demo of the data flywheel)

- **Misconception knowledge base** (`src/lib/journey/misconceptions.ts`): 21 prewritten, bilingual
  misconceptions, for example a reversed LED, a forgotten current-limiting resistor or a motor on an
  Arduino pin. Each has an ID, a skill tag, a description and a short correction. Wrong options in
  the local bank are mapped to them by skill and option text. A test checks that every mapping
  points at a real wrong option.
- **Local retrieval:** each Gemini diagnosis, plan and quiz request includes only the misconceptions
  behind the learner's recent wrong answers. Exact matches come first, then one per skill for
  unmatched wrong answers. There are at most 4 (3 for quizzes), limited to the skills the request
  may use.
- **Few-shot examples:** the mentor request gets up to 3 relevant bank questions and one short
  example diagnosis. The quiz request gets 2 style examples, preferring questions the learner has
  already seen, so a copied one is rejected as a repeat.
- **Learning insights** (`/insights`, sidebar "Learning Insights"): plain counts over the
  learner's data on this device, labelled "Local demo data — in the full platform this is aggregated
  across all students". It shows:
  - the most common misconceptions
  - the hardest questions (lowest correct rate)
  - which re-explanations (prewritten or Gemini, shown before a retry) were followed by a pass

  No AI is used for this screen.
- **Export:** "Export anonymized JSON" downloads answer records and outcomes in the format
  `aipm.learning-records` v1:
  - learners as `learner-1`, `learner-2`
  - level, project ID and parts
  - mastery and stage results
  - every attempt with its score and plan kind
  - every answer with the chosen and correct option and its misconception ID

  Names, project titles and descriptions are left out, and no API key is included.

### Learning journey (demo content)

- **Paths:** fully written for traffic light, parking sensor and automatic irrigation
  (`src/lib/journey/content.ts`). Beginners get an extra Electricity basics stage. Other
  descriptions get a path generated from the approved parts using catalog and connection-sheet
  data (`generic.ts`).
- **Quizzes:** 5 questions per quiz, chosen for the learner (see Personalized quizzes) and graded in
  the browser. Pass mark is 80%. Mentor strengths and weak points come from the skills of right
  and wrong answers.
- **Labels:** everything here is labelled "Demo content". Only Describe Project suggestions are
  AI.
- **Progress:** saved under `aipm.journey.v1`. Invalid data is reported and left untouched. Reset
  demo clears the journey and the BOM; saved lab circuits are kept.

## Limitations

- The interface labels (buttons, headings) stay bilingual side by side; only the learning content
  switches language. The catalog, BOM and 3D Lab screens are unchanged.
- Gemini answers are checked for structure, repeats, skills and part names, but their technical
  accuracy can't be fully verified automatically. Reworded repeats aren't detected; only exact
  repeats after normalization are.
- Level "advanced" uses the same stages as "intermediate"; it only allows jumping to the quiz.

- AI suggestions can be incomplete or wrong. Students should review every part and quantity
  before approving. The model only chooses from the 43 catalog parts.
- The API key is visible in the browser bundle (see above).
- The free tier has per-minute and per-day request limits set by Google. When they're reached,
  AiPM shows "free limit reached" and uses the demo engine until you try again.
- Wiring validation is **rule-based**. It checks power, ground, pin types, voltage and current
  limits, connection counts and shorts from catalog data. It doesn't simulate circuits or run code.
- Pin maps are functional groupings, not physical package drawings. Always check the original
  datasheet for your exact part.
- Datasheet links point to external manufacturer sites and need an internet connection. Parts
  without a confirmed document say so instead of linking a guess.
- The DM Sans web font loads from Google Fonts when online. Offline, the system font is used.
- The mentor analysis is checked for structure, evidence, skills, stages and part names, but
  whether a stated misconception is really what the learner thinks can't be verified
  automatically. With few answers (after the level check, 3) it says its confidence is low.
- Plans can reorder only stages whose declared prerequisites allow it: the parking sensor's
  distance and buzzer stages, the irrigation sensor and relay stages, and generated part stages.
  The traffic-light stages build on each other, so their order doesn't change.
- AI lessons, feedback, wiring help and part information are checked for structure, length,
  language, links and part names, and practice tasks must use a real pin name. Their technical
  accuracy still can't be verified automatically.
- The demo cache matches by learner, checkpoint and language. A cached result is shown only if it
  still passes validation against the learner's current answers. Feedback and wiring help are
  reused only for exactly the same wrong choices or validation results. If the presenter strays
  from the script, one live request is made instead.
- The AI mentor chat, external 3D search and AI model generation aren't part of this prototype
  yet.

## Project structure

```
src/
  main.tsx, router.tsx        app entry and routes (TanStack Router, client-only)
  routes/                     Home, Describe, Catalog, BOM and Lab pages
  lib/suggest/                suggestParts(), Gemini engine, validation, demo engine, examples
  lib/journey/                learning journey: content, paths, level, grading, generic paths, store
  routes/journey/             journey screens
  components/                 catalog workbench, previews, connection sheets, sidebar, brand
  components/lab/             HardwareLab and its wiring assistant
  components/ui/              shadcn/Radix primitives used by the migrated screens
  lib/lab/                    lab catalog, Three.js models and engine, validation, wire rules
  lib/componentCatalog.ts     catalog entries (key → lab model) and BOM persistence
  lib/componentDocuments.ts   datasheet and documentation references
  lib/componentSheets.ts      pin explanations and connection guides
  lib/storage.ts              namespaced localStorage helpers
  styles.css                  LabAssist styles used by these screens
  test/                       migrated unit tests
```
