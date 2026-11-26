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
npm test           # Vitest (lab catalog and wiring rule tests migrated from LabAssist)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## What's included

| Screen | Route | Notes |
| --- | --- | --- |
| Home | `/` | Two entry points ("I have a project idea", "I don't have an idea yet"), continue journey, **Reset demo** |
| Learning journey | `/journey`, `/journey/choose`, `/journey/level`, `/journey/stage?id=`, `/journey/ready` | Choose a learning project or continue from approved parts, take a level check, then follow gated stages. Each stage has a lesson, its parts (View in 3D / Practice in 3D Lab) and a quiz; pass with 80% to unlock the next. A failed quiz shows mentor feedback and a second quiz version. Ends with "Ready to build your project" |
| New component | `/journey/new-component` | Planned flow for parts not in the catalog, marked "Coming soon". It returns no results |
| Describe your project | `/describe` | Describe a project in Arabic or English, or pick an example. Suggested parts come with a summary, quantity, role and reason. Review them, edit quantities, add or remove parts, then **Approve list** to add them to the BOM |
| Component Catalog | `/catalog` | 43 parts in 8 categories. Category workbench with a 3D preview, a searchable library (English/Arabic) filtered by category and supply voltage, details with pins, connection sheets and original datasheet links. `?part=<key>` opens one part's details |
| Bill of Materials | `/bom` | Parts added from the catalog, with quantities. Saved in `localStorage` |
| 3D Lab | `/lab` | Place, move, rotate and wire parts. Choose wire types, validate wiring with rules, undo/redo, save circuits and versions. `?add=<model>&request=<id>` places a part |

### Local data

| Key | Contents |
| --- | --- |
| `aipm.bom.v1` | `[{ key, quantity }]` BOM entries (catalog keys) |
| `aipm.lab.project.v1` | Lab project: circuits, parts, wires and saved versions |

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
- **Demo suggestions (local)**: used when there's no key or the call fails. That covers the free
  limit being reached (429), an invalid key, the network, a timeout after 30 s, a blocked or empty
  answer, or an unusable response. The page says why, in Arabic and English. Example projects
  return curated local results; other text uses keyword matching.

### Personalized quizzes (phase 5)

- **Learner profile** (per learner, inside the journey): mastery per skill (0–100, updated after
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
- **Demo learners:** a "Student A / Student B" switch keeps two separate journeys, to show different
  quizzes on the same stage. Reset demo clears both.
- **Language:** Arabic by default (technical terms stay in English), switchable on the path page.
  Local content is prewritten in English.

### Learning journey (demo content)

- **Paths:** fully written for traffic light, parking sensor and automatic irrigation
  (`src/lib/journey/content.ts`). Beginners get an extra Electricity basics stage. Other
  descriptions get a path generated from the approved parts using catalog and connection-sheet
  data (`generic.ts`).
- **Quizzes:** 5 questions per quiz, chosen per learner (see Personalized quizzes) and graded in
  the browser. Pass mark is 80%. Mentor strengths and weak points come from the skills of right
  and wrong answers.
- **Labels:** everything here is labelled "Demo content". Only Describe Project suggestions are
  AI.
- **Progress:** saved under `aipm.journey.v1`. Invalid data is reported and left untouched. Reset
  demo clears the journey and the BOM; saved lab circuits are kept.

## Limitations

- Lesson text and local quiz content are in English, with Arabic titles and labels. Only Gemini
  quizzes and explanations follow the Arabic/English setting.
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
- The AI mentor chat, adaptive learning, quizzes, external 3D search and AI model generation aren't
  part of this prototype yet.

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
