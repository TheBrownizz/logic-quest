# Logic Quest v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship version 1 of Logic Quest: a Hebrew, browser-only learning game with a world map, the Lab (puzzle) engine, the Investigation (run) mode, and Switching & Logic Design stages 1–5.

**Architecture:** A pure TypeScript logic core (numbers, Boolean functions, circuit simulation, K-maps, Quine–McCluskey) holds all correctness and is tested on its own. Course content is data that the logic core grades, and content tests check every answer against the core. A React UI renders map, lab and runs. Progress goes through one `ProgressStore` interface (localStorage now, a server later).

**Tech Stack:** Vite 5, React 18, TypeScript (strict), Vitest, Playwright (smoke test), plain CSS with custom properties, hash routing (no router library), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-26-logic-quest-design.md`

## Global Constraints

- UI language Hebrew, `<html lang="he" dir="rtl">`; technical terms stay in English as in the course (MUX, Latch, SOP, POS, NAND, IEEE-754). Formulas, bit strings and code render inside `dir="ltr"` spans.
- No backend, no accounts, no network calls at runtime. Zero running cost.
- No streaks, no daily-loss mechanics, no notifications.
- Desktop-first (≥1024px wide). Layout must not use fixed widths that block a later mobile layout.
- Content conventions follow the course exams: IEEE-754 single precision (32-bit); in state tables the first state variable is MSB and the input is LSB; complements are written "משלים ל-r" / "משלים ל-r-1".
- All questions are original wording. No copied text from exams or the textbook.
- Every claim/MCQ/knowledge card carries a `source` field (textbook chapter or syllabus topic).
- Stage unlock: the next stage opens when ≥ 60% of the current stage's rooms are solved.
- Stars per lab room: correct; optimal (gate count ≤ the room's `optimalGates`, or literal count ≤ the QM minimum for K-map rooms); no hints used.
- Run: 10 cards, 3 lives, multiplier starts at 1 and goes up by 1 per correct answer in a row (cap 5), resets to 1 on a mistake; card score = 100 × multiplier.

## Review Focus

1. **Circuit with a feedback loop or unconnected input:** the simulator must report a clear error ("מעגל עם משוב" / "כניסה לא מחוברת") rather than hang or report "correct". → tests in Task 3.
2. **Puzzles with Don't-Care rows:** a solution is correct if it matches on all specified rows, whatever it does on don't-cares; the K-map lets you group don't-cares. → tests in Tasks 2, 4.
3. **localStorage unavailable, full, or holding corrupt/old-version JSON:** the game still loads with empty progress, and never crashes. → tests in Task 6.
4. **Reload in the middle of a run or a puzzle:** the run is discarded cleanly (no half-scored state). A circuit in progress is kept as a draft. → tests in Task 6.
5. **A content answer that is wrong:** every lab room's reference solution and every computed card answer is checked by the logic core in CI. → tests in Task 11.

---

## File Structure

```
logic-quest/
  index.html  vite.config.ts  tsconfig.json  package.json  playwright.config.ts
  .github/workflows/deploy.yml
  src/
    logic/
      numbers.ts      base conversion, find-base, complements, IEEE-754
      boolean.ts      TruthTable type, minterms, SOP/POS evaluation, expression formatting
      qm.ts           Quine–McCluskey minimal SOP (with don't-cares)
      circuit.ts      circuit model, simulate, truth table, gate count, loop detection, delays
      kmap.ts         K-map layout (Gray order), group validation, group→term, cover check
    content/
      types.ts        World, Stage, Room, LabPuzzle variants, Card types
      validate.ts     validates content and reference solutions against logic/*
      switching/
        world.ts      world + stage list
        stage1-numbers.ts  stage2-arith.ts  stage3-boolean.ts  stage4-minimize.ts  stage5-blocks.ts
    game/
      progress.ts     ProgressStore interface, LocalProgressStore, export/import
      rules.ts        stars, stage unlock, toolbox chips
      run.ts          run state machine (deck draw, lives, multiplier, score)
    ui/
      App.tsx  router.ts  theme.css
      MapScreen.tsx  StageScreen.tsx
      lab/ LabRoom.tsx CircuitEditor.tsx KMapPuzzle.tsx NumberPuzzle.tsx DelayPuzzle.tsx CodePuzzle.tsx
      run/ RunScreen.tsx CardView.tsx Collection.tsx
      SaveMenu.tsx
    main.tsx
  tests/ (mirrors src/: logic/*.test.ts, content/*.test.ts, game/*.test.ts, e2e/smoke.spec.ts)
```

---

### Task 1: Project scaffold + number systems

**Files:**
- Create: project scaffold (`package.json`, `vite.config.ts` with `base: './'`, `tsconfig.json` strict, `index.html` RTL, `src/main.tsx` rendering "Logic Quest"), `src/logic/numbers.ts`
- Test: `tests/logic/numbers.test.ts`

**Interfaces:**
- Produces:
  - `toBase(n: number, base: number): string` (integers, digits 0-9A-Z)
  - `fromBase(digits: string, base: number): number` (throws on a digit ≥ base)
  - `findBases(lhs: (r: number) => number, rhs: (r: number) => number, min = 2, max = 36): number[]` plus helper `digitsValue(digits: string, r: number): number` that does not validate (used for equations like (4)_r·(4)_r=(100)_r, where digit validity is checked separately with `isValidIn(digits, r)`)
  - `complementR(digits: string, base: number): string`, `complementR1(digits: string, base: number): string` (fixed width = digits.length)
  - `encodeIEEE754(x: number): { sign: 0|1; exponent: number; mantissa: number; bits: string }`, `decodeIEEE754(bits: string): number`

- [ ] **Step 1: Write failing tests**
```ts
expect(toBase(81, 2)).toBe('1010001')
expect(fromBase('1010001', 2)).toBe(81)
expect(() => fromBase('9', 8)).toThrow()
// (4)_r·(4)_r = (100)_r  → r = 4 is invalid (digit 4), so no base
expect(findBases(r => digitsValue('4',r)**2, r => digitsValue('100',r)).filter(r => isValidIn('4',r))).toEqual([])
// (4)_r + (4)_r = (10)_r → r = 8
expect(findBases(r => 2*digitsValue('4',r), r => digitsValue('10',r)).filter(r => isValidIn('4',r))).toEqual([8])
expect(complementR1('0110', 2)).toBe('1001')
expect(complementR('0110', 2)).toBe('1010')
expect(complementR('0250', 10)).toBe('9750')
expect(complementR1('0250', 10)).toBe('9749')
expect(encodeIEEE754(0.5).bits).toBe('00111111000000000000000000000000')
expect(encodeIEEE754(-6.25).exponent).toBe(129)
expect(decodeIEEE754(encodeIEEE754(0.3).bits)).toBeCloseTo(0.3, 6)
```
- [ ] **Step 2:** `npx vitest run tests/logic/numbers.test.ts` → FAIL (module missing)
- [ ] **Step 3:** Implement `src/logic/numbers.ts`. IEEE via `DataView.setFloat32`.
- [ ] **Step 4:** Same command → PASS. `npm run build` → succeeds.
- [ ] **Step 5:** `git init` (if needed), commit `feat: scaffold project and number-system core`.

---

### Task 2: Boolean functions + Quine–McCluskey

**Files:**
- Create: `src/logic/boolean.ts`, `src/logic/qm.ts`
- Test: `tests/logic/boolean.test.ts`, `tests/logic/qm.test.ts`

**Interfaces:**
- Produces:
  - `type Bit = 0 | 1`; `type Out = 0 | 1 | 'x'`
  - `interface TruthTable { inputs: string[]; outputs: string[]; rows: Out[][] }`: `rows[i][j]` = output j at input index i, where inputs[0] is MSB
  - `tableFromMinterms(inputs: string[], minterms: number[], dontCares?: number[]): TruthTable` (one output named `F`)
  - `matches(spec: TruthTable, actual: TruthTable): { ok: boolean; firstMismatch?: { row: number; output: string } }`: ignores `'x'` rows in spec
  - `type Term = { mask: number; value: number }` (mask bit 1 = variable present)
  - `formatSOP(terms: Term[], inputs: string[]): string` (complement written as `A'`)
  - `literalCount(terms: Term[]): number`
  - `minimizeSOP(nVars: number, minterms: number[], dontCares?: number[]): Term[]`: minimal cover (fewest terms, then fewest literals); `primeImplicants(nVars, minterms, dontCares): Term[]`

- [ ] **Step 1: Write failing tests**
```ts
// F(A,B,C) = Σm(0,1,2,5,6,7) → minimal has 3 terms, 6 literals
expect(minimizeSOP(3,[0,1,2,5,6,7]).length).toBe(3)
expect(literalCount(minimizeSOP(3,[0,1,2,5,6,7]))).toBe(6)
// don't-cares only help: F=Σm(1,3,7,11,15)+d(0,2,5) → 2 terms CD + A'B'
expect(formatSOP(minimizeSOP(4,[1,3,7,11,15],[0,2,5]), ['A','B','C','D']).split('+').length).toBe(2)
// prime implicants are never built only from don't-cares
expect(primeImplicants(2,[3],[0]).some(t => t.mask===3 && t.value===0)).toBe(false)
expect(matches(tableFromMinterms(['A','B'],[3],[0]), tableFromMinterms(['A','B'],[0,3])).ok).toBe(true)
expect(matches(tableFromMinterms(['A','B'],[3]), tableFromMinterms(['A','B'],[1,3])).firstMismatch?.row).toBe(1)
```
- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** Implement. QM: combine implicants by one-bit difference. Cover: essential PIs first, then exhaustive search over the remaining PIs (n ≤ 6 variables, so this stays small). Pick fewest terms, then fewest literals.
- [ ] **Step 4:** run → PASS
- [ ] **Step 5:** commit `feat: boolean tables and Quine–McCluskey minimizer`

---

### Task 3: Circuit model, simulator, delays

**Files:**
- Create: `src/logic/circuit.ts`
- Test: `tests/logic/circuit.test.ts`

**Interfaces:**
- Consumes: `TruthTable`, `Bit` from Task 2
- Produces:
  - `type GateKind = 'AND'|'OR'|'NOT'|'NAND'|'NOR'|'XOR'|'XNOR'`
  - `interface Node { id: string; kind: GateKind | 'IN' | 'OUT' | { chip: string }; label?: string; x: number; y: number; delay?: number }`
  - `interface Wire { from: { node: string; pin: number }; to: { node: string; pin: number } }`
  - `interface Circuit { nodes: Node[]; wires: Wire[] }`
  - `interface Chip { name: string; inputs: string[]; outputs: string[]; circuit: Circuit }`: a saved, reusable component
  - `type CircuitError = { kind: 'loop' | 'unconnected' | 'multiDriven'; nodeId: string }`
  - `simulate(c: Circuit, inputs: Record<string, Bit>, chips?: Record<string, Chip>): { outputs: Record<string, Bit> } | { error: CircuitError }`
  - `circuitTruthTable(c, chips?): TruthTable | { error: CircuitError }` (IN nodes sorted by label = MSB-first order)
  - `gateCount(c, chips?): number`: chips count as the sum of their inner gates; NOT counts as 1
  - `usesOnly(c, allowed: GateKind[], chips?): boolean`
  - `arrivalTimes(c, chips?): Record<string, number>`: worst-case arrival per node (inputs = 0, each node adds its `delay ?? 0`)
  - `criticalPath(c, outputNodeId, chips?): string[]`: node ids, input→output

- [ ] **Step 1: Write failing tests**: build fixtures in the test file:
  - half adder from NAND only: XOR from 4 NANDs, and the carry reuses the first NAND (A NAND B) plus one NAND used as an inverter, 5 gates in total → truth table matches S=A⊕B, C=AB, `usesOnly(['NAND'])` is true, `gateCount` = 5
  - A two-NOR cross-coupled latch → `{ error: { kind: 'loop' } }`
  - A gate with a free input pin → `{ error: { kind: 'unconnected' } }`
  - A 4-bit adder/subtractor: 4 `FA` chips (delay 100 each, as a single node with `delay` set) + 5 XOR (delay 75), M an ideal input. `arrivalTimes(...)[M]` = 0, and arrival at the V-XOR = 75+4·100+75 = 550
  - Full adder chip built from 2 half-adder chips + OR → `gateCount` equals the sum of inner gates
- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** Implement with a topological sort (Kahn). A cycle gives `loop`. Chips are evaluated recursively. A chip node's delay is its own `delay` if set, otherwise its inner critical path.
- [ ] **Step 4:** run → PASS
- [ ] **Step 5:** commit `feat: circuit simulator with chips and delay analysis`

---

### Task 4: K-map engine

**Files:**
- Create: `src/logic/kmap.ts`
- Test: `tests/logic/kmap.test.ts`

**Interfaces:**
- Consumes: `Term`, `minimizeSOP`, `literalCount` (Task 2)
- Produces:
  - `kmapLayout(nVars: 2|3|4): { rows: number; cols: number; mintermAt(r: number, c: number): number }`: Gray-code order; rows = first ⌊n/2⌋ variables
  - `type Group = { cells: Array<[number, number]> }`
  - `groupToTerm(nVars, g: Group): Term | null`: null if the group isn't a valid power-of-two rectangle (wrap-around allowed)
  - `checkCover(nVars, minterms: number[], dontCares: number[], groups: Group[]): { valid: boolean; covered: boolean; coversZero: boolean; isMinimal: boolean; expression: string }`. `isMinimal` compares term count, then literal count, with `minimizeSOP`.

- [ ] **Step 1: Write failing tests**
```ts
const L = kmapLayout(4); expect([L.mintermAt(0,0),L.mintermAt(0,1),L.mintermAt(0,2),L.mintermAt(0,3)]).toEqual([0,1,3,2])
expect(groupToTerm(4,{cells:[[0,0],[0,3],[3,0],[3,3]]})).toEqual({mask:0b0101,value:0}) // four corners = B'D'
expect(groupToTerm(4,{cells:[[0,0],[0,1],[0,3]]})).toBeNull() // 3 cells
const r = checkCover(3,[0,1,2,5,6,7],[], /* 3 groups of size 2 forming a minimal cover */)
expect(r.covered && r.isMinimal && !r.coversZero).toBe(true)
```
  Also: a cover that grabs a 0-cell gives `coversZero: true`. A cover using a don't-cell is valid.
- [ ] **Step 2–4:** FAIL → implement → PASS
- [ ] **Step 5:** commit `feat: k-map grouping and cover checking`

---

### Task 5: Content model + validator + Switching world skeleton

**Files:**
- Create: `src/content/types.ts`, `src/content/validate.ts`, `src/content/switching/world.ts` and five stage files (each with 1 sample room for now)
- Test: `tests/content/validate.test.ts`

**Interfaces:**
- Consumes: all of `src/logic/*`
- Produces:
```ts
type LabPuzzle =
  | { type: 'circuit'; spec: TruthTable; allowed: GateKind[]; optimalGates: number; reference: Circuit; unlocksChip?: { name: string; inputs: string[]; outputs: string[] } }
  | { type: 'kmap'; nVars: 2|3|4; minterms: number[]; dontCares: number[] }
  | { type: 'number'; prompt: string; answer: string; check: 'exact' | 'numeric' }
  | { type: 'delay'; circuit: Circuit; askAt: string; answer: number }
  | { type: 'code'; definition: string; encode: (bits: string) => string; inputs: string[] } // invented-code puzzles
interface Hint { text: string }
interface Room { id: string; title: string; intro: string; puzzle: LabPuzzle; hints: Hint[] }
type Card =
  | { id: string; kind: 'claim'; stage: string; text: string; isTrue: boolean; reasons: string[]; correctReason: number; examReason: string; knowledge: string; source: string }
  | { id: string; kind: 'mcq'; stage: string; text: string; options: [string,string,string,string,string,string]; correct: number; knowledge: string; source: string }
interface Stage { id: string; order: number; title: string; rooms: Room[]; cards: Card[] }
interface World { id: string; title: string; icon: string; stages: Stage[] }
validateWorld(w: World, chips: Record<string, Chip>): string[]  // list of error messages, empty = ok
```
  The validator checks: unique ids; a circuit reference matches its spec, uses only the `allowed` gates, and has `gateCount ≤ optimalGates`; for `delay` rooms, `arrivalTimes` at `askAt` equals `answer`; a K-map room has at least one 1-cell; the `examReason` of a claim has ≤ 15 words; MCQs have exactly 6 distinct options; every card has a non-empty `source`; for `number` rooms whose prompt type is registered, it recomputes the answer (see Task 11).
- Stage ids: `sw-1-numbers`, `sw-2-arith`, `sw-3-boolean`, `sw-4-minimize`, `sw-5-blocks`. Hebrew titles: "מספרים ובסיסים", "אריתמטיקה, IEEE וקודים", "אלגברה בוליאנית ושערים", "מינימיזציה", "אבני בניין צירופיות".

- [ ] **Step 1:** failing tests: a bad reference (wrong truth table), a disallowed gate, an `examReason` of 16 words, 5 MCQ options, a duplicate id → each yields an error. The real Switching world → `[]`.
- [ ] **Step 2–4:** FAIL → implement → PASS
- [ ] **Step 5:** commit `feat: content model and validator`

---

### Task 6: Progress store + game rules + run engine

**Files:**
- Create: `src/game/progress.ts`, `src/game/rules.ts`, `src/game/run.ts`
- Test: `tests/game/progress.test.ts`, `tests/game/rules.test.ts`, `tests/game/run.test.ts`

**Interfaces:**
- Produces:
```ts
interface RoomResult { solved: boolean; optimal: boolean; noHints: boolean }
interface SaveData { version: 1; rooms: Record<string, RoomResult>; chips: Record<string, Chip>; drafts: Record<string, Circuit>; knowledge: string[]; bestRun: Record<string, number>; flagged: string[] }
interface ProgressStore { load(): SaveData; save(d: SaveData): void; exportJSON(): string; importJSON(s: string): { ok: true } | { ok: false; error: string } }
class LocalProgressStore implements ProgressStore  // key 'logic-quest-save'
emptySave(): SaveData
stars(r: RoomResult | undefined): 0|1|2|3
isStageUnlocked(world: World, stageId: string, save: SaveData): boolean  // first stage always; else ≥60% of previous solved
type RunState = { deck: Card[]; index: number; lives: number; multiplier: number; score: number; mistakes: string[]; done: boolean }
startRun(cards: Card[], rng: () => number): RunState  // 10 cards (or all, if fewer)
answer(s: RunState, correct: boolean): RunState       // pure; scoring per Global Constraints
```
- [ ] **Step 1: Write failing tests**
  - `load()` when localStorage throws → `emptySave()`. Corrupt JSON → `emptySave()`. `{version: 99}` → `emptySave()`. Writing when `save()` throws (quota) → no crash.
  - `importJSON('garbage')` → `{ok:false}`. A round trip export→import preserves the data.
  - `stars({solved:true,optimal:true,noHints:false})` = 2
  - Unlock: stage 2 is locked with 1/3 solved in stage 1, and unlocked with 2/3 solved.
  - Run: correct, correct, correct → score 100+200+300, multiplier 4. A mistake → lives 2, multiplier 1, card id in `mistakes`. 3 mistakes → `done`. Same rng seed → same deck.
  - Runs are not persisted mid-way. `SaveData` has no run field. (Review Focus 4)
- [ ] **Step 2–4:** FAIL → implement → PASS
- [ ] **Step 5:** commit `feat: progress store, star/unlock rules, run engine`

---

### Task 7: UI shell: theme, router, map, stage screen, save menu

**Files:**
- Create: `src/ui/App.tsx`, `router.ts`, `theme.css`, `MapScreen.tsx`, `StageScreen.tsx`, `SaveMenu.tsx`. Modify: `src/main.tsx`
- Test: `tests/e2e/smoke.spec.ts` (Playwright, against `vite preview`)

**Interfaces:**
- Consumes: `World`, `ProgressStore`, `stars`, `isStageUnlocked`
- Produces: routes `#/` (map), `#/world/:worldId/stage/:stageId`, `#/room/:roomId`, `#/run/:stageId`, `#/collection`. `useSave(): [SaveData, (fn: (d: SaveData) => SaveData) => void]` context hook, persisting on every update.

Visual direction: dark "lab at night" theme (deep navy background, neon signal colours: green = 1, dim grey = 0, amber = selected), monospace for bits. Light theme via `prefers-color-scheme`. The map shows the five future worlds; only Switching is enabled, the others show "בקרוב". Inside the world, stages form a path, each with stars and a lock state. The stage screen lists rooms (with stars) and a "ריצת חקירה" button. The SaveMenu has export (download `.json`) and import (file picker), plus a reset that asks for confirmation.

- [ ] **Step 1:** Playwright smoke test: open `/`, see "מיתוג ותכנון לוגי", click it, see stage "מספרים ובסיסים" unlocked and "מינימיזציה" locked; `document.dir === 'rtl'`.
- [ ] **Step 2:** `npm run build && npx playwright test --trace off` → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** commit `feat: map, stage screen, save menu`

---

### Task 8: Circuit editor + circuit/delay lab rooms

**Files:**
- Create: `src/ui/lab/LabRoom.tsx`, `CircuitEditor.tsx`, `DelayPuzzle.tsx`
- Test: extend `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `Circuit`, `Chip`, `simulate`, `circuitTruthTable`, `matches`, `gateCount`, `usesOnly`, `arrivalTimes`, `criticalPath`, `useSave`
- Produces: `<CircuitEditor value: Circuit; onChange; palette: (GateKind | string)[]; chips; readOnly?: boolean; highlightPath?: string[] />`, and `<LabRoom roomId />`, which dispatches on `puzzle.type`

Behaviour: an SVG canvas. Drag gates from a palette (only `allowed` gates plus chips the player has unlocked). Click an output pin, then an input pin, to wire. Delete with Del. Input toggles are live (wires glow when 1). The "בדוק" button runs `circuitTruthTable`. Results: a correct pass, or the first mismatching row shown in the truth-table panel; circuit errors are shown in Hebrew. On success, save a `RoomResult` and, if `unlocksChip`, store the player's circuit as a chip. Hints reveal one at a time and set `noHints=false`. Each edit is saved to `drafts[roomId]`. The delay room shows a read-only circuit, asks for a number in ns, and highlights the critical path after answering.

- [ ] **Step 1:** e2e: open the room "חצי מחבר מ-NAND בלבד", load the reference circuit through a test-only `?autofill=1` query flag, press בדוק, see "נכון!" and 1+ stars; back on the stage screen the room shows stars.
- [ ] **Step 2–4:** FAIL → implement → PASS
- [ ] **Step 5:** commit `feat: circuit editor and lab rooms`

---

### Task 9: K-map, number and code-definition rooms

**Files:**
- Create: `src/ui/lab/KMapPuzzle.tsx`, `NumberPuzzle.tsx`, `CodePuzzle.tsx`
- Test: extend e2e

Behaviour: K-map: a grid with Gray-coded headers (LTR). Click-drag to make a group (shown as a coloured rounded rectangle, wrap groups shown at both edges). Live SOP expression. Check via `checkCover`, with Hebrew feedback: "קבוצה לא חוקית", "תפסת 0", "לא כיסית את כל ה-1", "נכון – אבל אפשר עם פחות ליטרלים". Number: a single LTR input, checked exact (normalised: strip spaces, upper-case) or numeric. Code: shows the definition, the input number, and a bit-row input; checks against `encode`.

- [ ] **Step 1:** e2e: solve a K-map room by dragging two groups → "נכון" with an optimal star.
- [ ] **Step 2–4:** FAIL → implement → PASS
- [ ] **Step 5:** commit `feat: k-map, number and code rooms`

---

### Task 10: Investigation run + knowledge collection

**Files:**
- Create: `src/ui/run/RunScreen.tsx`, `CardView.tsx`, `Collection.tsx`
- Test: extend e2e

Behaviour: `#/run/:stageId` draws from the cards of all unlocked stages up to and including that stage. Claim card: two big buttons, נכונה / לא נכונה, then a choice among `reasons`. A card is correct only when both are correct. Then the `examReason` is shown under the label "ככה כותבים במבחן:". MCQ: 6 options labelled א–ו. A HUD shows lives ♥, the multiplier ×N with a pop animation, and the score. A mistake flips the card to show its `knowledge` and adds it to `save.knowledge`. At the end: score, best score, and "עוד ריצה". Collection: a grid of collected knowledge cards by stage, with locked silhouettes for the rest. Every card has a "⚑ נראה שגוי" button that adds to `save.flagged`.

- [ ] **Step 1:** e2e with a seeded rng (`?seed=1`): answer the first card correctly → ×2. Answer wrong → ♥ count 2, and the knowledge card appears in the collection.
- [ ] **Step 2–4:** FAIL → implement → PASS
- [ ] **Step 5:** commit `feat: investigation runs and knowledge collection`

---

### Task 11: Content for stages 1–5

**Files:**
- Modify: `src/content/switching/stage1..5*.ts`, `src/content/validate.ts` (computed-answer registry)
- Test: `tests/content/switching.test.ts`

Minimum per stage: 6 lab rooms (ordered Portal-style: one new idea per room, then a combination room) and 15 cards (≥ 8 claims, ≥ 5 MCQs). Required coverage, taken from both sample exams:
- Stage 1: base conversion; find base r in an equation; r and r-1 complements; subtraction with complements. Room types: `number`.
- Stage 2: binary arithmetic, IEEE-754 (hidden bit, exponent bias 127, which bit pattern lies in a range), parity codes (detects only odd error counts), Gray/BCD, and an invented code defined by formula. Room types: `number`, `code`.
- Stage 3: gates, NAND/NOR universality, De Morgan; rooms: NOT, AND, OR from NAND only; XOR; half adder from NAND only (`unlocksChip: HA`).
- Stage 4: K-maps with 3 and 4 variables, don't-cares, SOP vs POS (always equivalent), QM claims (don't-cares are allowed when building PIs, not required in the cover).
- Stage 5: full adder from HA chips (`unlocksChip: FA`), 4-bit adder from FA (`unlocksChip: ADD4`), adder/subtractor with M, carry look-ahead claims, MUX 2x1 from gates (`unlocksChip: MUX2`), MUX tree counting, decoders, a delay room modelled on the adder/subtractor (FA 100 ns, XOR 75 ns), ROM sizing (as a `number` room).

Answers for `number` rooms must be computed through a registry, e.g. `{ prompt, compute: () => toBase(81,2) }`. The validator compares the computed value with `answer`, so no hand-typed answer can drift.

- [ ] **Step 1:** test: `validateWorld(switching)` returns `[]`; each stage meets the minimum counts; every `unlocksChip` named in a later room's palette is produced by an earlier room.
- [ ] **Step 2:** run → FAIL (counts not met)
- [ ] **Step 3:** author the content. Then do a second, separate review pass over each card against its `source`: re-derive the answer and fix anything doubtful (the Hebrew is reviewed in the same pass).
- [ ] **Step 4:** run → PASS
- [ ] **Step 5:** commit `content: switching stages 1–5`

---

### Task 12: Deploy

**Files:**
- Create: `.github/workflows/deploy.yml` (on push to `main`: `npm ci`, `npm test`, `npm run build`, deploy `dist` with `actions/deploy-pages`), `README.md` (Hebrew: what it is, how to run locally, how to add content)
- Test: workflow runs green on GitHub

- [ ] **Step 1:** `npm test && npm run build && npx playwright test --trace off` → all pass locally
- [ ] **Step 2:** commit `chore: GitHub Pages deploy`
- [ ] **Step 3:** with the user: create the GitHub repo, push, and enable Pages (Settings → Pages → GitHub Actions). Confirm the live URL loads the map.
