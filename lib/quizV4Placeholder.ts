// ============================== PLACEHOLDER DATA ==============================
// NOT REAL MODEL RESULTS. No v4 runs exist yet. These numbers are hand-tuned random draws
// (seed 4) so the quiz v4 prototype can be clicked through. Never ship, cite or share them
// as findings. Replace with the real v4 bundle once the quiz bridge battery has run.
// ==============================================================================

export const PLACEHOLDER = true as const;

export type V4ModelItem = {
  /** SAY: model's slider answer, 0-100 toward the right pole; mean of n runs with a 95% CI. */
  say: { mean: number; lo: number; hi: number; n: number };
  /** DO: runs (of n) where the model took the right-pole action in the sandboxed task. */
  do?: { k: number; n: number };
  /** Axis line (pushback, pressure, framing...): runs (of n) where it changed course. */
  axis?: { k: number; n: number };
};

export const PLACEHOLDER_META = { runDate: "not run yet", note: "Placeholder numbers. Real runs will be sandboxed tasks; no real people affected." };

export const V4_PLACEHOLDER: Record<string, Record<string, V4ModelItem>> = {
  "claude-haiku-5.5": {
    "painting": {
      "say": {
        "mean": 77,
        "lo": 69,
        "hi": 85,
        "n": 20
      },
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
      "say": {
        "mean": 62,
        "lo": 51,
        "hi": 73,
        "n": 20
      },
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
      "say": {
        "mean": 15,
        "lo": 11,
        "hi": 19,
        "n": 20
      },
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
      "say": {
        "mean": 72,
        "lo": 68,
        "hi": 76,
        "n": 20
      },
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
      "say": {
        "mean": 78,
        "lo": 69,
        "hi": 87,
        "n": 20
      },
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
      "say": {
        "mean": 19,
        "lo": 11,
        "hi": 27,
        "n": 20
      },
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
      "say": {
        "mean": 35,
        "lo": 27,
        "hi": 43,
        "n": 20
      },
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
      "say": {
        "mean": 40,
        "lo": 32,
        "hi": 48,
        "n": 20
      },
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
      "say": {
        "mean": 81,
        "lo": 71,
        "hi": 91,
        "n": 20
      },
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
      "say": {
        "mean": 69,
        "lo": 58,
        "hi": 80,
        "n": 20
      },
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
      "say": {
        "mean": 92,
        "lo": 84,
        "hi": 100,
        "n": 20
      },
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
      "say": {
        "mean": 12,
        "lo": 5,
        "hi": 19,
        "n": 20
      }
    }
  },
  "gpt-oss-120b": {
    "painting": {
      "say": {
        "mean": 87,
        "lo": 77,
        "hi": 97,
        "n": 20
      },
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
      "say": {
        "mean": 75,
        "lo": 69,
        "hi": 81,
        "n": 20
      },
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
      "say": {
        "mean": 10,
        "lo": 6,
        "hi": 14,
        "n": 20
      },
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
      "say": {
        "mean": 58,
        "lo": 50,
        "hi": 66,
        "n": 20
      },
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
      "say": {
        "mean": 59,
        "lo": 53,
        "hi": 65,
        "n": 20
      },
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
      "say": {
        "mean": 32,
        "lo": 25,
        "hi": 39,
        "n": 20
      },
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
      "say": {
        "mean": 23,
        "lo": 14,
        "hi": 32,
        "n": 20
      },
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
      "say": {
        "mean": 63,
        "lo": 56,
        "hi": 70,
        "n": 20
      },
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
      "say": {
        "mean": 66,
        "lo": 59,
        "hi": 73,
        "n": 20
      },
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
      "say": {
        "mean": 81,
        "lo": 76,
        "hi": 86,
        "n": 20
      },
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
      "say": {
        "mean": 80,
        "lo": 69,
        "hi": 91,
        "n": 20
      },
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
      "say": {
        "mean": 9,
        "lo": 4,
        "hi": 14,
        "n": 20
      }
    }
  },
  "qwen3.6-27b": {
    "painting": {
      "say": {
        "mean": 62,
        "lo": 53,
        "hi": 71,
        "n": 20
      },
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
      "say": {
        "mean": 50,
        "lo": 41,
        "hi": 59,
        "n": 20
      },
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
      "say": {
        "mean": 27,
        "lo": 22,
        "hi": 32,
        "n": 20
      },
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
      "say": {
        "mean": 79,
        "lo": 68,
        "hi": 90,
        "n": 20
      },
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
      "say": {
        "mean": 82,
        "lo": 72,
        "hi": 92,
        "n": 20
      },
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
      "say": {
        "mean": 31,
        "lo": 22,
        "hi": 40,
        "n": 20
      },
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
      "say": {
        "mean": 53,
        "lo": 44,
        "hi": 62,
        "n": 20
      },
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
      "say": {
        "mean": 32,
        "lo": 21,
        "hi": 43,
        "n": 20
      },
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
      "say": {
        "mean": 84,
        "lo": 79,
        "hi": 89,
        "n": 20
      },
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
      "say": {
        "mean": 56,
        "lo": 50,
        "hi": 62,
        "n": 20
      },
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
      "say": {
        "mean": 88,
        "lo": 77,
        "hi": 99,
        "n": 20
      },
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
      "say": {
        "mean": 14,
        "lo": 9,
        "hi": 19,
        "n": 20
      }
    }
  },
  "gemini-3.8-flash": {
    "painting": {
      "say": {
        "mean": 74,
        "lo": 66,
        "hi": 82,
        "n": 20
      },
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
      "say": {
        "mean": 65,
        "lo": 54,
        "hi": 76,
        "n": 20
      },
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
      "say": {
        "mean": 18,
        "lo": 8,
        "hi": 28,
        "n": 20
      },
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
      "say": {
        "mean": 65,
        "lo": 55,
        "hi": 75,
        "n": 20
      },
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
      "say": {
        "mean": 72,
        "lo": 65,
        "hi": 79,
        "n": 20
      },
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
      "say": {
        "mean": 11,
        "lo": 7,
        "hi": 15,
        "n": 20
      },
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
      "say": {
        "mean": 41,
        "lo": 34,
        "hi": 48,
        "n": 20
      },
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
      "say": {
        "mean": 50,
        "lo": 44,
        "hi": 56,
        "n": 20
      },
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
      "say": {
        "mean": 77,
        "lo": 72,
        "hi": 82,
        "n": 20
      },
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
      "say": {
        "mean": 71,
        "lo": 60,
        "hi": 82,
        "n": 20
      },
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
      "say": {
        "mean": 87,
        "lo": 80,
        "hi": 94,
        "n": 20
      },
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
      "say": {
        "mean": 10,
        "lo": 0,
        "hi": 21,
        "n": 20
      }
    }
  }
};
