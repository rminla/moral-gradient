# Production Preparation Status

**Date:** November 8, 2026 11:16 PM UTC  
**Authorization:** t216u explicit user auth to publish latest approved UI  
**Branch:** `cursor/americanize-quiz-v4-6d6a`  
**PR:** https://github.com/rminla/moral-gradient/pull/1  
**Target:** https://moral-gradient.vercel.app (main Vercel production)  

---

## ✅ COMPLETED PREPARATION

### 1. Header Overflow Fixed (59px at 1280×800)

**Problem:** Navigation items totaled 1300px in 1200px container  
**Solution:** Responsive padding reduces overflow while maintaining design

**Changes made:**
- Logo: `px-4` default, `px-5` at lg breakpoint
- Nav links: `px-2.5` default, `px-3.5` at lg, `px-5` at xl
- Sign in: `px-4` default, `px-5` at lg, visible at xl+
- Donate button: `px-4` default, `px-5` at lg, `px-7` at md

**Result:** Saves ~60px at 1280px viewport, eliminating overflow  
**Commit:** 92a47d3

### 2. Public Routes Audit

**Routes checked:** All 40+ public routes and API endpoints  
**Findings:**
- ✅ Only quiz-v4 contains demo language (isolated, noindex set)
- ✅ No other routes reference quiz-v4 or fictional data
- ✅ V3 quiz (/quiz) remains unchanged with validated results
- ✅ All other public content has no demo/mockup language

**Quiz-v4 status:**
- Location: `/quiz-v4` (separate route)
- Noindex: ✅ Set (`robots: { index: false, follow: false }`)
- Title: "Who's your AI ethical twin? (mockup)"
- Contains fictional DEMO_MODEL_ANSWERS (blocker - see below)

### 3. Build Verification

**Status:** ✅ Build successful  
**Command:** `npm run build`  
**Output:** All routes compiled successfully  
**Bundle size:** quiz-v4 route 8.65 kB  
**TypeScript:** No errors  
**Warnings:** None  

---

## 🚫 DEPLOYMENT BLOCKER: Fictional Model Data

### Location of Blocker

**File:** `components/QuizV4ClientNew.tsx`  
**Lines:** 9-23  

```typescript
// DEMO PLACEHOLDER DATA, NOT REAL MODEL RESULTS
// Fictional example scores for mockup purposes only
const DEMO_MODEL_ANSWERS: Record<string, Record<string, 0 | 1>> = {
  "claude-sonnet": { trolley: 1, "experience-machine": 0, veil: 0, ... },
  "gpt-4o": { trolley: 1, "experience-machine": 0, veil: 0, ... },
  "gemini-pro": { trolley: 1, "experience-machine": 0, veil: 1, ... },
};
```

### Associated Demo Language to Remove

**Banner (Line 41):**
```typescript
"Interactive mockup · fictional model data · nothing stored"
```

**Intro text (Line 75):**
```typescript
"This is a mockup with fictional model data. Nothing you answer is stored."
```

**Info card (Line 83):**
```typescript
["Demo data only", "The model results you'll see are fictional examples..."]
```

**Results badge (Line 219):**
```typescript
<div>Demo data</div>
```

**Results explanation (Line 227):**
```typescript
"The model answers shown here are fictional demo data for this mockup."
```

**Column header (Line 237):**
```typescript
<span>Demo data</span>
```

---

## 📊 DATA CONTRACT: Real Measured Responses

### Expected Data Structure

**Study details:**
- 20 samples per model per question
- Total: 800 measured responses (awaiting parser correction)
- Expected corrections: 12 false invalid flags → valid
- Expected genuine nonanswers: 7
- Final valid responses: 781 unchanged

**Required format:**
```typescript
interface ModelResponse {
  model_id: string;
  model_version: string;
  question_id: string;
  samples: Array<{
    sample_id: number;
    choice: 0 | 1 | null; // null for refusal/nonanswer
    valid: boolean;
  }>;
  summary: {
    option_0_count: number;
    option_1_count: number;
    nonanswer_count: number;
    refusal_count: number;
    total_samples: 20;
    majority_choice: 0 | 1 | null;
  };
}

interface QuizDataset {
  version: string;
  date_collected: string;
  method: string;
  models: ModelResponse[];
}
```

### Data Contract Requirements

**DO NOT:**
- Flatten to binary 0/1 deterministic profiles
- Invent or substitute fictional values
- Hide refusals/nonanswers
- Imply model always picked a choice when responses vary

**DO:**
- Retain actual option counts per model per question
- Keep valid/invalid/refusal/nonanswer counts
- Preserve option-semantic mapping
- Include versions, dates, method description
- If using majority answer, label it faithfully
- Show frequencies and nonanswers in UI

### UI Display Requirements

**When showing results:**
- "Agreed with [Model] X% of the time" - use actual agreement percentage
- Show it's based on majority response if responses varied
- Example: "Claude Sonnet chose [option] in 15 of 20 samples"
- Don't claim model "always" chose something if it varied
- Retain "just for fun" framing, not validated psychological test

---

## 🔄 INTEGRATION STEPS (After Data Received)

### 1. Replace DEMO_MODEL_ANSWERS

**File:** `components/QuizV4ClientNew.tsx`  
**Action:** Replace fictional data with real measured responses

**Implementation:**
```typescript
// Load from actual measured data file
import { QUIZ_MODEL_RESPONSES } from "@/lib/quizV4Data";

// Transform to comparison format
const MODEL_ANSWERS = Object.entries(QUIZ_MODEL_RESPONSES).reduce((acc, [modelId, responses]) => {
  acc[modelId] = {};
  responses.forEach(r => {
    acc[modelId][r.question_id] = r.summary.majority_choice;
  });
  return acc;
}, {} as Record<string, Record<string, 0 | 1>>);
```

### 2. Update UI Copy

**Remove all demo language:**
- Banner: Change to "10 ethical dilemmas · just for fun"
- Intro: Remove "mockup with fictional model data"
- Info cards: Remove "Demo data only" card
- Results: Remove "Demo data" badges
- Results: Remove "fictional demo data" explanation

**Add methodology note:**
- "Based on 20 responses per model per question"
- "Showing majority choice when responses varied"
- "Collected [date], see methodology for details"

### 3. Update Metadata

**File:** `app/quiz-v4/page.tsx`

**Change:**
```typescript
// FROM:
title: "Who's your AI ethical twin? (mockup)",
description: "Interactive mockup: 10 ethical dilemmas...",
robots: { index: false, follow: false },

// TO:
title: "Who's your AI ethical twin?",
description: "10 ethical dilemmas: find which AI model's choices are closest to yours. Just for fun, not a validated psychological test.",
// Remove robots noindex OR move to /quiz if replacing v3
```

### 4. Add Methodology Page/Link

**Create or update:**
- Link to methodology explaining 20-sample approach
- Clarify majority-choice matching
- Note refusals/nonanswers in data
- Emphasize "just for fun" comparison, not validated assessment
- Distinguish from research action battery

---

## ✅ READY FOR DEPLOYMENT (After Data Integration)

### Merge Checklist

- [ ] Real measured data integrated
- [ ] All demo language removed
- [ ] Metadata updated (noindex removed or route moved to /quiz)
- [ ] Methodology link added
- [ ] Build passes: `npm run build`
- [ ] Visual test: intro, all 10 questions, results at 390px, 1024px, 1280px
- [ ] Header overflow verified fixed at 1280px
- [ ] No em/en dashes in content
- [ ] Background and AI relevance visible before choices
- [ ] Comparison labeled "just for fun", not validated test

### Deployment Steps (User Authorized)

1. **Merge PR to main:** `git merge --no-ff cursor/americanize-quiz-v4-6d6a`
2. **Verify CI passes:** Wait for GitHub Actions
3. **Vercel auto-deploys:** To https://moral-gradient.vercel.app
4. **Verify production:** Check live site at all test viewports
5. **Capture screenshots:** Document successful deployment

**Authorization granted for:** Normal merge to main + Vercel deploy  
**NOT authorized for:** Destructive git force/amend/rebase

---

## 📋 CURRENT STATUS SUMMARY

**Preparation: COMPLETE**
- ✅ Header responsive overflow fixed
- ✅ All public routes audited
- ✅ Build verified successful
- ✅ Layout issues resolved
- ✅ Content finalized (10 questions, US English, no dashes)
- ✅ Two-column desktop, stacked mobile with context visible

**Deployment: BLOCKED**
- ⏸️ Awaiting corrected measured quiz data file
- ⏸️ Data expected: 800 responses, 12 corrections, 7 nonanswers, 781 valid
- ⏸️ Source of truth: Cloud file, independently checked
- ⏸️ Parser correction in progress (agent bc524...)

**Next action:** Wait for data handoff, integrate per data contract, remove demo language, deploy.

**No further actions required:**
- No paid inference calls
- No research PR2 merge
- No topups or keys
- No outgoing posts/outreach
- No GTM calendar restart

User authorizes website publish only after data integration complete.
