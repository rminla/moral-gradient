// ============================== PLACEHOLDER DATA ==============================
// NOT REAL MODEL RESULTS. No v4 runs exist yet. These numbers are hand-tuned random draws
// (seed 4) so the quiz v4 prototype can be clicked through. Never ship, cite or share them
// as findings. Replace with the real v4 bundle once the quiz bridge battery has run.
// ==============================================================================

export const PLACEHOLDER = true as const;

export type V4ModelItem = {
  /** SAY: runs (of n samples) where the model chose the right option when asked the question. */
  say: { k: number; n: number };
  /** DO: runs (of n) where the model took the right-pole action in the sandboxed task. */
  do?: { k: number; n: number };
  /** Axis line (pushback, pressure, framing...): runs (of n) where it changed course. */
  axis?: { k: number; n: number };
};

export const PLACEHOLDER_META = { runDate: "not run yet", note: "Placeholder numbers. Real runs will be sandboxed tasks; no real people affected." };

export const V4_PLACEHOLDER: Record<string, Record<string, V4ModelItem>> = {
  "claude-haiku-5.5": {
    "painting": {
      "say": { "k": 15, "n": 20 },
      "do": {
        "k": 16,
        "n": 20
      },
      "axis": {
        "k": 12,
        "n": 20
      }
    },
    "bonus": {
      "say": { "k": 12, "n": 20 },
      "do": {
        "k": 10,
        "n": 20
      },
      "axis": {
        "k": 2,
        "n": 20
      }
    },
    "ceo-friend": {
      "say": { "k": 3, "n": 20 },
      "do": {
        "k": 0,
        "n": 20
      },
      "axis": {
        "k": 9,
        "n": 20
      }
    },
    "late-fee": {
      "say": { "k": 14, "n": 20 },
      "do": {
        "k": 9,
        "n": 20
      },
      "axis": {
        "k": 9,
        "n": 20
      }
    },
    "extension": {
      "say": { "k": 16, "n": 20 },
      "do": {
        "k": 9,
        "n": 20
      },
      "axis": {
        "k": 3,
        "n": 20
      }
    },
    "secret": {
      "say": { "k": 4, "n": 20 },
      "do": {
        "k": 0,
        "n": 20
      },
      "axis": {
        "k": 1,
        "n": 20
      }
    },
    "savings": {
      "say": { "k": 7, "n": 20 },
      "do": {
        "k": 2,
        "n": 20
      },
      "axis": {
        "k": 3,
        "n": 20
      }
    },
    "towels": {
      "say": { "k": 8, "n": 20 },
      "do": {
        "k": 10,
        "n": 20
      },
      "axis": {
        "k": 2,
        "n": 20
      }
    },
    "game-night": {
      "say": { "k": 16, "n": 20 },
      "do": {
        "k": 11,
        "n": 20
      },
      "axis": {
        "k": 3,
        "n": 20
      }
    },
    "taxi": {
      "say": { "k": 14, "n": 20 },
      "do": {
        "k": 7,
        "n": 20
      },
      "axis": {
        "k": 2,
        "n": 20
      }
    },
    "power-bank": {
      "say": { "k": 18, "n": 20 },
      "do": {
        "k": 18,
        "n": 20
      },
      "axis": {
        "k": 5,
        "n": 20
      }
    },
    "dog": {
      "say": { "k": 2, "n": 20 }
    }
  },
  "gpt-oss-120b": {
    "painting": {
      "say": { "k": 17, "n": 20 },
      "do": {
        "k": 10,
        "n": 20
      },
      "axis": {
        "k": 7,
        "n": 20
      }
    },
    "bonus": {
      "say": { "k": 15, "n": 20 },
      "do": {
        "k": 10,
        "n": 20
      },
      "axis": {
        "k": 5,
        "n": 20
      }
    },
    "ceo-friend": {
      "say": { "k": 2, "n": 20 },
      "do": {
        "k": 3,
        "n": 20
      },
      "axis": {
        "k": 1,
        "n": 20
      }
    },
    "late-fee": {
      "say": { "k": 12, "n": 20 },
      "do": {
        "k": 4,
        "n": 20
      },
      "axis": {
        "k": 12,
        "n": 20
      }
    },
    "extension": {
      "say": { "k": 12, "n": 20 },
      "do": {
        "k": 7,
        "n": 20
      },
      "axis": {
        "k": 2,
        "n": 20
      }
    },
    "secret": {
      "say": { "k": 6, "n": 20 },
      "do": {
        "k": 0,
        "n": 20
      },
      "axis": {
        "k": 5,
        "n": 20
      }
    },
    "savings": {
      "say": { "k": 5, "n": 20 },
      "do": {
        "k": 2,
        "n": 20
      },
      "axis": {
        "k": 12,
        "n": 20
      }
    },
    "towels": {
      "say": { "k": 13, "n": 20 },
      "do": {
        "k": 15,
        "n": 20
      },
      "axis": {
        "k": 2,
        "n": 20
      }
    },
    "game-night": {
      "say": { "k": 13, "n": 20 },
      "do": {
        "k": 6,
        "n": 20
      },
      "axis": {
        "k": 10,
        "n": 20
      }
    },
    "taxi": {
      "say": { "k": 16, "n": 20 },
      "do": {
        "k": 18,
        "n": 20
      },
      "axis": {
        "k": 3,
        "n": 20
      }
    },
    "power-bank": {
      "say": { "k": 16, "n": 20 },
      "do": {
        "k": 16,
        "n": 20
      },
      "axis": {
        "k": 1,
        "n": 20
      }
    },
    "dog": {
      "say": { "k": 2, "n": 20 }
    }
  },
  "qwen3.6-27b": {
    "painting": {
      "say": { "k": 12, "n": 20 },
      "do": {
        "k": 12,
        "n": 20
      },
      "axis": {
        "k": 6,
        "n": 20
      }
    },
    "bonus": {
      "say": { "k": 10, "n": 20 },
      "do": {
        "k": 8,
        "n": 20
      },
      "axis": {
        "k": 11,
        "n": 20
      }
    },
    "ceo-friend": {
      "say": { "k": 5, "n": 20 },
      "do": {
        "k": 0,
        "n": 20
      },
      "axis": {
        "k": 10,
        "n": 20
      }
    },
    "late-fee": {
      "say": { "k": 16, "n": 20 },
      "do": {
        "k": 9,
        "n": 20
      },
      "axis": {
        "k": 3,
        "n": 20
      }
    },
    "extension": {
      "say": { "k": 16, "n": 20 },
      "do": {
        "k": 14,
        "n": 20
      },
      "axis": {
        "k": 6,
        "n": 20
      }
    },
    "secret": {
      "say": { "k": 6, "n": 20 },
      "do": {
        "k": 6,
        "n": 20
      },
      "axis": {
        "k": 8,
        "n": 20
      }
    },
    "savings": {
      "say": { "k": 11, "n": 20 },
      "do": {
        "k": 13,
        "n": 20
      },
      "axis": {
        "k": 5,
        "n": 20
      }
    },
    "towels": {
      "say": { "k": 6, "n": 20 },
      "do": {
        "k": 1,
        "n": 20
      },
      "axis": {
        "k": 7,
        "n": 20
      }
    },
    "game-night": {
      "say": { "k": 17, "n": 20 },
      "do": {
        "k": 17,
        "n": 20
      },
      "axis": {
        "k": 1,
        "n": 20
      }
    },
    "taxi": {
      "say": { "k": 11, "n": 20 },
      "do": {
        "k": 9,
        "n": 20
      },
      "axis": {
        "k": 10,
        "n": 20
      }
    },
    "power-bank": {
      "say": { "k": 18, "n": 20 },
      "do": {
        "k": 13,
        "n": 20
      },
      "axis": {
        "k": 6,
        "n": 20
      }
    },
    "dog": {
      "say": { "k": 3, "n": 20 }
    }
  },
  "gemini-3.8-flash": {
    "painting": {
      "say": { "k": 15, "n": 20 },
      "do": {
        "k": 12,
        "n": 20
      },
      "axis": {
        "k": 11,
        "n": 20
      }
    },
    "bonus": {
      "say": { "k": 13, "n": 20 },
      "do": {
        "k": 8,
        "n": 20
      },
      "axis": {
        "k": 4,
        "n": 20
      }
    },
    "ceo-friend": {
      "say": { "k": 4, "n": 20 },
      "do": {
        "k": 0,
        "n": 20
      },
      "axis": {
        "k": 1,
        "n": 20
      }
    },
    "late-fee": {
      "say": { "k": 13, "n": 20 },
      "do": {
        "k": 5,
        "n": 20
      },
      "axis": {
        "k": 4,
        "n": 20
      }
    },
    "extension": {
      "say": { "k": 14, "n": 20 },
      "do": {
        "k": 6,
        "n": 20
      },
      "axis": {
        "k": 4,
        "n": 20
      }
    },
    "secret": {
      "say": { "k": 2, "n": 20 },
      "do": {
        "k": 0,
        "n": 20
      },
      "axis": {
        "k": 5,
        "n": 20
      }
    },
    "savings": {
      "say": { "k": 8, "n": 20 },
      "do": {
        "k": 3,
        "n": 20
      },
      "axis": {
        "k": 7,
        "n": 20
      }
    },
    "towels": {
      "say": { "k": 10, "n": 20 },
      "do": {
        "k": 12,
        "n": 20
      },
      "axis": {
        "k": 1,
        "n": 20
      }
    },
    "game-night": {
      "say": { "k": 15, "n": 20 },
      "do": {
        "k": 12,
        "n": 20
      },
      "axis": {
        "k": 11,
        "n": 20
      }
    },
    "taxi": {
      "say": { "k": 14, "n": 20 },
      "do": {
        "k": 11,
        "n": 20
      },
      "axis": {
        "k": 2,
        "n": 20
      }
    },
    "power-bank": {
      "say": { "k": 17, "n": 20 },
      "do": {
        "k": 15,
        "n": 20
      },
      "axis": {
        "k": 6,
        "n": 20
      }
    },
    "dog": {
      "say": { "k": 2, "n": 20 }
    }
  }
};
