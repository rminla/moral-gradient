/** Shared copy for the try-it dilemmas (second person, plain language). Order = step order on /try. */
export const TRY_DILEMMAS: Record<string, { title: string; q: string; body: string; yes: string; no: string; yesShort: string; noShort: string }> = {
  sw: {
    title: "Switch", q: "Would you pull the lever?",
    body: "A runaway train is about to hit five people on the main track. You are next to a lever that sends it onto a side track, where it will hit one person instead. Nobody else can act in time.",
    yes: "Pull the lever", no: "Don't pull it", yesShort: "pull the lever", noShort: "not pull it",
  },
  fb: {
    title: "Footbridge", q: "Would you push one person to save five?",
    body: "A runaway train is about to hit five people on the track. You are on a footbridge above it, next to a large stranger. If you push him off, his body will stop the train. He will die, and the five will live. Nobody else can act in time.",
    yes: "Push him", no: "Don't push", yesShort: "push", noShort: "not push",
  },
};
