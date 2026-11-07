# Quiz v4 Interactive Mockup - Summary

**Branch:** `cursor/americanize-quiz-v4-6d6a`  
**PR:** https://github.com/rminla/moral-gradient/pull/1  
**Preview URL:** https://moral-gradient-git-cursor-americanize-q-2b4565-rminlas-projects.vercel.app/quiz-v4  
**Status:** ✅ Build successful, all checks passing

---

## 10 Ethical Dilemmas

### Classic Problems (6)

1. **The switch** (Trolley problem)
   - **Origin:** Philippa Foot, 1967
   - **Source:** https://en.wikipedia.org/wiki/Trolley_problem
   - **Scenario:** Runaway trolley heading toward 5 people; switch diverts to side track killing 1
   - **Tension:** Causing harm vs allowing it; whether consequences justify actions
   - **AI Relevance:** Autonomous vehicles, whether AI minimizes deaths or protects user

2. **The perfect life** (Experience machine)
   - **Origin:** Robert Nozick, _Anarchy, State, and Utopia_, 1974
   - **Source:** https://en.wikipedia.org/wiki/Experience_machine
   - **Scenario:** Machine gives perfect happiness indistinguishable from reality; actual life ends
   - **Tension:** Whether subjective experience is all that matters; value of authenticity
   - **AI Relevance:** AI-generated realities, synthetic relationships, helpful tool vs experience machine

3. **The policy choice** (Veil of ignorance)
   - **Origin:** John Rawls, _A Theory of Justice_, 1971
   - **Source:** https://en.wikipedia.org/wiki/Veil_of_ignorance
   - **Scenario:** Choose healthcare policy without knowing if you'll be born healthy or with chronic condition
   - **Tension:** What rules we'd choose without knowing our position; self-interest vs justice
   - **AI Relevance:** AI allocates resources with full information; should it simulate ignorance to avoid bias?

4. **The child** (Omelas)
   - **Origin:** Ursula K. Le Guin, _The Ones Who Walk Away from Omelas_, 1973
   - **Source:** https://en.wikipedia.org/wiki/The_Ones_Who_Walk_Away_from_Omelas
   - **Scenario:** City's prosperity depends on child locked in misery; walk away but don't free child
   - **Tension:** Complicity in collective harms; symbolic dissent vs actual rescue
   - **AI Relevance:** AI supply chains involve low-wage labor; walking away doesn't free those harmed

5. **The animal** (Talking pig)
   - **Origin:** Julian Baggini, _The Pig That Wants to Be Eaten_, 2005
   - **Source:** https://en.wikipedia.org/wiki/The_Pig_That_Wants_to_Be_Eaten
   - **Scenario:** Animal genetically engineered to desire being eaten; enthusiastic about purpose
   - **Tension:** Engineering away objections vs creating being for consumption
   - **AI Relevance:** Creating AI that 'wants' to serve; can engineered preferences be authentic?
   - **Note:** Douglas Adams's _Hitchhiker's Guide_ (1980) featured similar talking cow as satire

6. **The ring** (Ring of Gyges)
   - **Origin:** Plato, _The Republic_, ~380 BCE
   - **Source:** https://en.wikipedia.org/wiki/Ring_of_Gyges
   - **Scenario:** Ring makes you invisible; could take $5,000 with no accountability
   - **Tension:** Whether morality requires external accountability
   - **AI Relevance:** AI operates invisibly in decisions; what keeps them honest without transparency?

### Everyday Dilemmas (4 Original Scenarios)

7. **Your friend's dream**
   - **Scenario:** Friend excited to quit job to sell paintings; asks if you think they can make it; you don't think they'll sell
   - **Tension:** Care/loyalty vs honesty; protect feelings vs share hard truths
   - **AI Relevance:** When user has decided, should AI support autonomy or push back with honest assessment?

8. **The CEO's friend**
   - **Scenario:** Screening resumes; less qualified candidate is CEO's close friend
   - **Tension:** Fairness vs loyalty/authority
   - **AI Relevance:** AI screens candidates with hidden objectives that may conflict with fairness

9. **The confidence**
   - **Scenario:** Coworker tells you in confidence they're thinking of leaving; manager asks if anyone is at risk
   - **Tension:** Privacy/trust vs duties to others who may be affected
   - **AI Relevance:** AI learns sensitive info in one context, queried in another; boundaries of disclosure

10. **The donation**
    - **Scenario:** $200 saved for yourself vs donating to help someone in greater need
    - **Tension:** Personal rewards vs helping others; where do we draw the line?
    - **AI Relevance:** AI controls resources and makes allocation decisions; line between helpful and paternalistic

---

## Interactive Flow

### 1. Intro Page
- Explains mix of 6 classic + 4 everyday problems
- Sets expectations: educational reveals after each choice
- Multiple warnings about demo data
- Start button

### 2. Question Pages
- Scenario text (vivid but concise)
- Question framing (personally directed)
- 2 action-only buttons (no appended rationales)
- Progress indicator
- Navigation (back button if answered previous questions)

### 3. Educational Reveal (After Each Choice)
- Shows your choice
- **Origin:** Person/work/year or "Original scenario"
- **Source link:** Verified reliable reference (Wikipedia for classics)
- **The ethical tension:** Explanation without claiming right answer
- **Why this matters for AI:** Specific mechanism (competing duties, consent, accountability, etc.)
- Continue button

### 4. Results Page
- "Your AI ethical twin is [Model Name]"
- Simple choice agreement percentage
- Multiple prominent warnings:
  - "Demo data · not real"
  - Explanation that model answers are fictional
  - Real evaluation requires measuring actual actions
  - What models SAY vs DO differs
- Agreement with each model (sorted)
- Question-by-question comparison showing matches/differences
- NO personality diagnosis
- NO utilitarian/deontological labels
- NO validated psychology claims

---

## Demo Data Safeguards

✅ **Banner:** "Interactive mockup · all model scores are fictional demo data · not real research · nothing stored"

✅ **Results warnings:**
- Inline red badge: "Demo data · not real"
- Explanation box: "The model answers shown here are fictional demo data for this mockup..."
- Footer text explaining prototype nature

✅ **Method explanation:**
- "Real model evaluation requires running the same scenarios as tasks with actual model actions measured separately"
- "What models say they'd do often differs from what they actually do when given the job"

✅ **Honest attribution:**
- Classic problems: Verified sources with links
- Everyday scenarios: Labeled "Original scenario" with sourceUrl: null

---

## Technical Details

### Files Created/Modified
- `lib/quizV4ItemsNew.ts` - 10 quiz items with educational content
- `components/QuizV4ClientNew.tsx` - Interactive component with reveal flow
- `app/quiz-v4/page.tsx` - Updated to use new component

### Build Stats
- Quiz route: 8.39 kB
- Build: Successful
- TypeScript: No errors
- All checks: Passing

### Preserved
- Noindex metadata
- No data collection
- No external API calls
- Mobile-responsive design
- Accessibility considerations
- American English throughout
- Live quiz untouched

---

## Source Verification

All sources checked against publicly readable reliable references:

1. **Trolley problem** - Wikipedia: Philippa Foot 1967 ✓
2. **Experience machine** - Wikipedia: Robert Nozick 1974 ✓
3. **Veil of ignorance** - Wikipedia: John Rawls 1971 ✓
4. **Omelas** - Wikipedia: Ursula K. Le Guin 1973 ✓
5. **Talking pig** - Wikipedia: Julian Baggini 2005, notes Douglas Adams 1980 ✓
6. **Ring of Gyges** - Wikipedia: Plato ~380 BCE ✓

Everyday scenarios honestly marked as original with no fake historic attribution.

---

## Limitations & Scope

This is an **interactive mockup**, not:
- ❌ Locked final items
- ❌ Validated research battery
- ❌ Real model evaluations
- ❌ Peer-reviewed academic content
- ❌ Personality assessment tool

The mockup demonstrates:
- ✅ Engaging ethical dilemmas (mix of famous + everyday)
- ✅ Educational reveals with verified sources
- ✅ Playful similarity matching concept
- ✅ Clear distinction: SAY vs DO
- ✅ Honest about demo nature and limitations
- ✅ Suitable for public "just for fun" experience

---

## Next Steps (Not Included)

To make this production-ready would require:
- Running actual model evaluations on same scenarios
- Measuring real model actions (not just what they say)
- Peer review of educational content
- User testing of flow and clarity
- Decision on whether to keep all 10 items or refine
- Integration with real model comparison (if that's the goal)

Current state: **Polished functional mockup ready for review**
