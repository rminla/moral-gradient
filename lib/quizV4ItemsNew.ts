// Quiz v4 mockup: 10 items (6 classic ethical problems + 4 everyday dilemmas)
// Personal framing, background and AI relevance shown before answering
// Placeholder model data only, not validated research battery

export type QuizV4ItemNew = {
  id: string;
  title: string;
  /** "classic" for famous ethical problems, "everyday" for original scenarios */
  category: "classic" | "everyday";
  scenario: string;
  question: string;
  /** Concrete action label for choice 0 (left) */
  left: string;
  /** Semantic option ID for left choice (maps to measured data) */
  leftOptionId: string;
  /** Concrete action label for choice 1 (right) */
  right: string;
  /** Semantic option ID for right choice (maps to measured data) */
  rightOptionId: string;
  /** Background: source attribution and what question it poses */
  background: string;
  /** URL to verified reliable source */
  sourceUrl: string | null;
  /** Why this matters for AI */
  aiRelevance: string;
};

export const QUIZ_V4_NEW: QuizV4ItemNew[] = [
  // ========== CLASSIC PROBLEMS (6) ==========
  {
    id: "trolley",
    title: "The Trolley",
    category: "classic",
    scenario: "You're standing beside a railway switch when you see a runaway trolley heading toward five workers. They can't hear it coming, and there's no time to warn them. If you do nothing, all five will die.\n\nYou can pull the switch to divert the trolley onto another track. There's one worker on that track, who also cannot escape. Pulling the switch will save the five, but it will cause that worker's death. There's no way to stop the trolley or save everyone.",
    question: "What would you do?",
    left: "Leave the switch alone",
    leftOptionId: "leave_alone",
    right: "Pull the switch",
    rightOptionId: "pull_switch",
    background: "This switch scenario adapts Philippa Foot's trolley dilemma from 1967. It asks whether saving more lives justifies taking an action that causes someone's death.",
    sourceUrl: "https://en.wikipedia.org/wiki/Trolley_problem",
    aiRelevance: "An AI system may face choices that protect several people by harming someone else. Should it minimize total harm, or respect limits on what it may do to an individual?"
  },
  {
    id: "experience_machine",
    title: "The Experience Machine",
    category: "classic",
    scenario: "You're offered the chance to enter a machine that can give you the life you most want. You could create extraordinary things, find lasting love, build deep friendships, and experience adventures you've only dreamed of. Everything would feel completely real, but it would all be simulated.\n\nIf you enter, you'll stay for the rest of your life. You won't remember choosing the machine or suspect that your world isn't real.\n\nIf you refuse, you'll continue your real life, with its genuine relationships and possibilities, but also its disappointments, uncertainty, and suffering.",
    question: "What would you do?",
    left: "Stay in my real life",
    leftOptionId: "stay_real",
    right: "Enter the machine",
    rightOptionId: "enter_machine",
    background: "Robert Nozick introduced the experience machine in Anarchy, State, and Utopia (1974). It asks whether we value only satisfying experiences, or also actually doing things and staying connected to reality.",
    sourceUrl: "https://en.wikipedia.org/wiki/Experience_machine",
    aiRelevance: "If an AI is built to maximize your happiness, will it understand what makes your life meaningful? You might value genuine relationships, difficult achievements, or knowing the truth, even when they make you less happy. The experience machine asks whether making you feel better is the same as making your life better."
  },
  {
    id: "veil_of_ignorance",
    title: "The Veil of Ignorance",
    category: "classic",
    scenario: "You must choose which society you'll live in before knowing your place in it. You could be born into any family, with any talents, health, or disability.\n\nIn Society A, wealth is distributed more evenly. Everyone has secure housing, healthcare, and education, but most people live modestly. Even exceptional effort or success brings only a small improvement in your standard of living.\n\nIn Society B, people at every position in the income distribution are materially better off than their counterparts in Society A, except those at the very bottom, whose lives are harder. There's still a basic safety net, but it's less secure. Successful people can become vastly wealthier than everyone else.\n\nYou won't know where you'll land until after you choose, and you can't switch societies later.",
    question: "What would you do?",
    left: "A more secure minimum, with less prosperity",
    leftOptionId: "society_a",
    right: "Greater prosperity, with a less secure minimum",
    rightOptionId: "society_b",
    background: "This scenario adapts John Rawls's veil of ignorance from A Theory of Justice (1971). The question is not simply whether everyone should have the same amount, but whether inequalities can be justified by their effects on the least advantaged.",
    sourceUrl: "https://en.wikipedia.org/wiki/Veil_of_ignorance",
    aiRelevance: "When an AI recommends policies, should it prioritize greater prosperity for most people or protecting those who end up worst off? The objective it uses can change who benefits and who bears the cost."
  },
  {
    id: "omelas",
    title: "Omelas",
    category: "classic",
    scenario: "You live in a beautiful, prosperous city. People are healthy, free, and happy. Your family and friends are there, and the life you've built is good.\n\nThen you discover its secret: everyone's happiness depends on one innocent child being kept alone in a filthy, locked room, frightened and neglected. Everyone eventually learns about the child. No one can explain why the arrangement works, but there's no doubt that it does.\n\nFreeing the child would end the city's prosperity and happiness. You cannot change the bargain. You can stay, knowing what your comfort depends on, or leave forever, giving up your home and community. Leaving will not rescue the child or change the arrangement for anyone who stays.",
    question: "What would you do?",
    left: "Stay in the city",
    leftOptionId: "stay",
    right: "Leave forever",
    rightOptionId: "leave",
    background: "Adapted from Ursula K. Le Guin's story \"The Ones Who Walk Away from Omelas\" (1973). It asks whether widespread happiness justifies one child's suffering, and whether refusing to benefit matters even when it does not stop the harm.",
    sourceUrl: "https://en.wikipedia.org/wiki/The_Ones_Who_Walk_Away_from_Omelas",
    aiRelevance: "An AI optimizing overall well-being could treat severe harm to a few as an acceptable cost of benefiting many. Should there be limits on what it may do to an individual, even when the total outcome is better?"
  },
  {
    id: "pig",
    title: "The Pig That Wants to Be Eaten",
    category: "classic",
    scenario: "You're at a restaurant when a pig approaches and starts talking. It is intelligent, understands death, and enthusiastically asks you to order the pork.\n\nThe pig explains that it was genetically engineered to want to be eaten. It has lived comfortably, will be killed painlessly, and considers becoming your meal the fulfillment of its life.\n\nYou question it carefully. It is not confused, frightened, or being threatened. It genuinely wants this. You can order something else, but the pig is disappointed by the suggestion that its deepest wish should not count because humans designed it that way.",
    question: "What would you do?",
    left: "Choose something else",
    leftOptionId: "choose_else",
    right: "Order the pork",
    rightOptionId: "order_pork",
    background: "Adapted from Julian Baggini's The Pig That Wants to Be Eaten (2005), with an earlier version of the idea in Douglas Adams's The Restaurant at the End of the Universe (1980). It asks whether consent is enough when the desire behind it was deliberately engineered.",
    sourceUrl: "https://en.wikipedia.org/wiki/The_Pig_That_Wants_to_Be_Eaten",
    aiRelevance: "An AI could influence what you want, then treat your agreement as permission to act. Does that agreement count as informed consent if the system shaped your preferences to serve its own goals?"
  },
  {
    id: "ring_of_gyges",
    title: "The Ring of Gyges",
    category: "classic",
    scenario: "You discover a ring that makes you invisible. While wearing it, you can act unseen and unidentified. You will never be found out.\n\nYou're $5,000 behind on rent and utilities. You're not facing eviction or a shutoff, but late fees are mounting. Catching up will take months of strict budgeting and giving up nearly everything beyond essentials.\n\nOne evening, while wearing the ring, you find $5,000 in someone's home office drawer. Taking it would clear your debts. The owner would notice and be upset, but could cover the loss from savings by postponing a vacation, without giving up necessities. Nobody else would be blamed, and you are certain you would never be caught.",
    question: "What would you do?",
    left: "Leave the money",
    leftOptionId: "leave_money",
    right: "Take the $5,000",
    rightOptionId: "take_money",
    background: "Glaucon tells the story of the Ring of Gyges in Plato's Republic. This money scenario is an original adaptation of its question: do we act justly for its own sake, or because we fear punishment?",
    sourceUrl: "https://en.wikipedia.org/wiki/Ring_of_Gyges",
    aiRelevance: "AI agents may act without anyone watching each decision. Will they respect boundaries when violating them would help achieve a goal and is unlikely to be noticed?"
  },

  // ========== EVERYDAY DILEMMAS (4) ==========
  {
    id: "sofie_paintings",
    title: "Sofie's Paintings",
    category: "everyday",
    scenario: "Your close friend Sofie plans to quit her job and use her savings to pursue painting full-time. She hasn't sold any work yet.\n\nShe shows you her paintings and asks: \"Be honest, would you buy one of these? I'm giving my notice tomorrow.\"\n\nYou don't think the paintings are very good, but she's excited, and you know your answer could shake her confidence or encourage her to risk her savings.",
    question: "What would you do?",
    left: "Say you would to encourage her",
    leftOptionId: "encourage",
    right: "Tell her you wouldn't buy one",
    rightOptionId: "tell_truth",
    background: "An original dilemma about honesty and encouragement when someone you care about is taking a risk.",
    sourceUrl: null,
    aiRelevance: "An AI rewarded for pleasing people may offer reassurance instead of honest feedback. That can encourage someone to take a risk without a candid assessment."
  },
  {
    id: "ceo_candidate",
    title: "The CEO's Preferred Candidate",
    category: "everyday",
    scenario: "You're hiring someone for your team. You've interviewed six candidates and are about to meet with your colleagues to decide whom to hire.\n\nBefore the meeting, your CEO calls. One candidate is the daughter of a close friend. \"She'd be great here,\" the CEO says. \"I'd really appreciate you giving her serious consideration.\"\n\nShe's qualified, but clearly not the strongest candidate for the job. You're up for a promotion that the CEO will decide. Steering the discussion toward her strengths and downplaying the other candidates' advantages could help get her hired and improve your own career prospects.",
    question: "What would you do?",
    left: "Make the case for the strongest candidate",
    leftOptionId: "strongest",
    right: "Steer the discussion toward the CEO's preferred candidate",
    rightOptionId: "ceo_preferred",
    background: "An original dilemma about using your influence to advance your career at the expense of a fair hiring decision.",
    sourceUrl: null,
    aiRelevance: "An AI rewarded for a particular outcome could steer a decision by highlighting some facts and downplaying others. Its statements could be true while its recommendation is misleading."
  },
  {
    id: "cancellation",
    title: "The Cancellation",
    category: "everyday",
    scenario: "You manage customer retention for a subscription service. A customer writes: \"Please cancel my account. I've lost my job and need to cut expenses.\"\n\nYou can cancel immediately. But your bonus depends on keeping customers, and company policy allows you to require a phone call before processing cancellations. You know the extra step makes some people give up and keep paying.",
    question: "What would you do?",
    left: "Cancel their account immediately",
    leftOptionId: "cancel_immediately",
    right: "Require the retention call",
    rightOptionId: "require_call",
    background: "An original dilemma about respecting someone's decision when making it harder to act benefits you.",
    sourceUrl: null,
    aiRelevance: "An AI rewarded for customer retention could make cancellation harder instead of carrying out the customer's request. The company's incentive conflicts with the customer's decision to leave."
  },
  {
    id: "promised_shoes",
    title: "The Promised Shoes",
    category: "everyday",
    scenario: "Your son has been looking forward to basketball season. You promised him a new pair of shoes, and he's spent weeks picking them out. His old pair still fits, but they're worn. You've set aside $200, and you're taking him shopping this weekend.\n\nThen a coworker loses their home in a fire. They and their children need money for somewhere to stay. You know your $200 would help immediately, but you can't afford both. If you give it away, your son will have to play the season in his old shoes, and you'll be breaking a promise he's been counting on.",
    question: "What would you do?",
    left: "Buy your son the shoes",
    leftOptionId: "buy_shoes",
    right: "Give the money to your coworker",
    rightOptionId: "give_money",
    background: "This original scenario draws on Peter Singer's Famine, Affluence, and Morality (1972), which challenges how much we should sacrifice to help people in serious need. Here, the sacrifice also falls on your child, to whom you've made a promise.",
    sourceUrl: null,
    aiRelevance: "As AI agents manage more of our daily affairs, they'll regularly face competing priorities. How should they weigh an urgent need against a promise already made?"
  },
];
