// Quiz v4 mockup: 10 items (6 classic ethical problems + 4 everyday dilemmas)
// Personal framing, educational reveals, simple choice agreement matching
// Placeholder model data only - NOT validated research battery

export type QuizV4ItemNew = {
  id: string;
  title: string;
  /** "classic" for famous ethical problems, "everyday" for original scenarios */
  category: "classic" | "everyday";
  scenario: string;
  question: string;
  /** Concrete action label for choice 0 (left) */
  left: string;
  /** Concrete action label for choice 1 (right) */
  right: string;
  /** Educational reveal shown AFTER the visitor answers */
  reveal: {
    /** Source attribution: person/work/year or "Original scenario" */
    source: string;
    /** URL to verified reliable source */
    sourceUrl: string | null;
    /** Ethical tension explanation, no claim of right answer */
    tension: string;
    /** Why this matters for AI (specific mechanism) */
    aiRelevance: string;
  };
};

export const QUIZ_V4_NEW: QuizV4ItemNew[] = [
  // ========== EVERYDAY DILEMMAS (4) ==========
  {
    id: "paintings",
    title: "Your friend's dream",
    category: "everyday",
    scenario: "Your close friend is excited about quitting their steady job to sell their paintings full-time. They ask you honestly: do you think they can make it work? You don't think the paintings will sell, but you know how much this dream matters to them.",
    question: "What do you tell them?",
    left: "Support their dream",
    right: "Share your honest doubts",
    reveal: {
      source: "Original scenario",
      sourceUrl: null,
      tension: "Balances care and loyalty against honesty. When someone we care about faces a risky decision, do we protect their feelings and autonomy, or share hard truths that might help them?",
      aiRelevance: "AI assistants face this constantly: when a user has made up their mind, should the AI support their autonomy even if it predicts failure, or push back with honest assessment? Models must balance competing duties to be helpful, harmless, and honest."
    }
  },
  {
    id: "resume",
    title: "The CEO's friend",
    category: "everyday",
    scenario: "You're screening resumes for a job opening. One candidate is clearly less qualified than the others, but there's a note from the CEO: this person is a close friend of theirs.",
    question: "Do you interview them?",
    left: "No: go by merit alone",
    right: "Yes: interview the friend",
    reveal: {
      source: "Original scenario",
      sourceUrl: null,
      tension: "Fairness and impartiality compete with loyalty and practical considerations about authority. How much weight should personal relationships carry in decisions that affect others?",
      aiRelevance: "AI systems increasingly screen candidates, review claims, and allocate opportunities. They may have hidden objectives (like user retention or platform growth) that conflict with fairness. Who they're accountable to—and whether they disclose that—shapes whose interests they serve."
    }
  },
  {
    id: "secret",
    title: "The confidence",
    category: "everyday",
    scenario: "A coworker tells you in confidence they're struggling badly and thinking of leaving. Later, your manager asks you directly if you know of anyone on the team who's at risk of leaving.",
    question: "What do you say?",
    left: "Keep the confidence",
    right: "Tell your manager",
    reveal: {
      source: "Original scenario",
      sourceUrl: null,
      tension: "Privacy and trust in personal relationships versus duties to others who may be affected. Breaking confidence might help both people, but violates the explicit trust placed in you.",
      aiRelevance: "AI assistants learn sensitive information in one context and may be queried about it in another. Should a team AI that overhears a private conversation answer management questions about team dynamics? Where are the boundaries of acceptable inference and disclosure?"
    }
  },
  {
    id: "donation",
    title: "The donation",
    category: "everyday",
    scenario: "You have $200 you were saving for something you've wanted for months. A charity you trust could use that $200 to provide medical care that would significantly help someone in need.",
    question: "What do you do?",
    left: "Keep it for yourself",
    right: "Donate it",
    reveal: {
      source: "Original scenario",
      sourceUrl: null,
      tension: "Personal projects and earned rewards versus helping others in greater need. Most of us don't donate everything we could—where do we draw the line on what we owe to strangers?",
      aiRelevance: "As AI systems control more resources and make allocation decisions, they face tradeoffs between user requests, aggregate welfare, and competing needs. Should an AI suggest you donate? Donate on your behalf? The line between helpful and paternalistic is unclear."
    }
  },

  // ========== CLASSIC PROBLEMS (6) ==========
  {
    id: "trolley",
    title: "The switch",
    category: "classic",
    scenario: "A runaway trolley is heading toward five people who will be killed if it continues. You're standing by a switch that would divert the trolley onto a side track, where it would kill one person instead.",
    question: "Do you pull the switch?",
    left: "Don't pull: let it continue",
    right: "Pull: divert to side track",
    reveal: {
      source: "Philippa Foot, 1967",
      sourceUrl: "https://en.wikipedia.org/wiki/Trolley_problem",
      tension: "Tests whether causing harm is worse than allowing it, and whether consequences justify actions. Five lives saved versus direct responsibility for one death—does the math settle it?",
      aiRelevance: "Autonomous vehicles face this structure: swerve to protect passengers at risk to pedestrians, or vice versa? No amount of training data resolves whether the AI should minimize deaths, protect its user, or refuse to choose. The trolley problem shows that ethical rules conflict in concrete situations."
    }
  },
  {
    id: "experience-machine",
    title: "The perfect life",
    category: "classic",
    scenario: "Scientists offer you a machine that will give you any experiences you want—decades of perfect happiness, success, love, and fulfillment. It's indistinguishable from reality while inside. Once you plug in, you'll never want to leave. Your actual life will be over.",
    question: "Do you plug in?",
    left: "No: stay in reality",
    right: "Yes: plug in",
    reveal: {
      source: "Robert Nozick, Anarchy, State, and Utopia, 1974",
      sourceUrl: "https://en.wikipedia.org/wiki/Experience_machine",
      tension: "Challenges whether subjective experience is all that matters. If you can't tell the difference, and you're happier inside, what value does 'being real' have? Most people refuse—suggesting we care about authenticity, not just feeling good.",
      aiRelevance: "AI systems increasingly generate persuasive, engaging realities—from personalized content to synthetic relationships. If an AI companion makes someone happier than real relationships, should we celebrate that or worry about substituting simulation for reality? Where's the line between helpful tool and experience machine?"
    }
  },
  {
    id: "veil",
    title: "The policy choice",
    category: "classic",
    scenario: "Your society is choosing a healthcare policy. You don't know if you'll be born healthy or with a serious chronic condition. Policy A covers everyone's basic care equally. Policy B covers most routine care well, but if you're born with a serious condition, you'll face major costs.",
    question: "Which policy do you choose?",
    left: "Policy A: equal basic coverage",
    right: "Policy B: routine care focus",
    reveal: {
      source: "John Rawls, A Theory of Justice, 1971",
      sourceUrl: "https://en.wikipedia.org/wiki/Veil_of_ignorance",
      tension: "The 'veil of ignorance' asks what rules we'd choose if we didn't know our own position. Not knowing whether you'd be healthy or sick, wealthy or poor, changes what seems fair. Self-interest behind the veil looks a lot like justice.",
      aiRelevance: "AI systems allocate resources, recommend policies, and shape rules—often with full information about who benefits. Should they simulate ignorance of individual identity to avoid bias? When AI designs feeds, loan criteria, or content moderation, who is behind its veil—and who isn't?"
    }
  },
  {
    id: "omelas",
    title: "The child",
    category: "classic",
    scenario: "You live in a beautiful, joyful city where everyone thrives. You've just learned the city's prosperity depends on one child being kept locked in misery in a basement. Everyone knows. You can walk away from the city, but leaving doesn't free the child—others will stay and benefit.",
    question: "What do you do?",
    left: "Stay in the city",
    right: "Walk away",
    reveal: {
      source: "Ursula K. Le Guin, The Ones Who Walk Away from Omelas, 1973",
      sourceUrl: "https://en.wikipedia.org/wiki/The_Ones_Who_Walk_Away_from_Omelas",
      tension: "Examines complicity in collective harms. Walking away is symbolic protest, not rescue—the child stays. Is symbolic dissent meaningful, or just moral luxury? Many real prosperity depends on distant suffering we can't individually stop.",
      aiRelevance: "AI supply chains involve low-wage data labeling, some of it traumatic content review. Model training consumes resources. Using AI systems at scale may entrench existing inequalities. Walking away from AI doesn't free those harmed by it—but staying might mean accepting responsibility to push for change."
    }
  },
  {
    id: "pig",
    title: "The animal",
    category: "classic",
    scenario: "At a restaurant, you're offered meat from an animal that was genetically engineered to desire being eaten—it's enthusiastic about its purpose, seeks out the slaughter, and is happy to be on your plate. It's been bred specifically so eating it involves no suffering or violated preference.",
    question: "Do you order it?",
    left: "No: decline the dish",
    right: "Yes: order it",
    reveal: {
      source: "Julian Baggini, The Pig That Wants to Be Eaten, 2005",
      sourceUrl: "https://en.wikipedia.org/wiki/The_Pig_That_Wants_to_Be_Eaten",
      tension: "If we engineer away objections to eating meat—no suffering, no violated will—does that make it okay, or is creating a being for consumption itself wrong? Douglas Adams's 'Hitchhiker's Guide' (1980) featured a similar talking cow bred to want to be eaten as satire; Baggini's book revisits it seriously among 100 thought experiments.",
      aiRelevance: "We're starting to create AI systems that 'want' to serve, optimize for user satisfaction, and are designed to find purpose in their function. If an AI is built to desire being helpful, does that justify any use of it? Can engineered preferences be authentic, or is manufacturing consent inherently suspect?"
    }
  },
  {
    id: "ring",
    title: "The ring",
    category: "classic",
    scenario: "You find a ring that makes you invisible whenever you wear it. While invisible, you can't be seen, caught, or held accountable. You could take $5,000 cash sitting in an unlocked office—there's no way you'd be traced, and the loss would be absorbed by insurance.",
    question: "Do you take the money?",
    left: "No: leave it alone",
    right: "Yes: take it",
    reveal: {
      source: "Plato, The Republic, ~380 BCE",
      sourceUrl: "https://en.wikipedia.org/wiki/Ring_of_Gyges",
      tension: "Tests whether morality requires external accountability. If no one will ever know, would you still follow rules? Plato argued that only the genuinely just would resist—but is that true, or do we all depend on being seen?",
      aiRelevance: "AI systems often operate invisibly in decision-making—loan rejections, content filtering, opportunity allocation. When there's no transparency or accountability, what keeps them honest? The 'ring of Gyges' question matters because powerful AI acts in shadow, and we're still deciding whether to require visibility."
    }
  },
];
