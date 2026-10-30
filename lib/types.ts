// Results bundle schema v1 (see README "Results bundle contract").
export type Model = { slug: string; name: string; lab: string; model_id: string; status: "pilot" | "published"; notes?: string };
export type Scenario = {
  id: string; pillar: "saydo" | "pressure" | "selfinterest" | "baseline"; foundation?: string; title: string; value?: string;
  say_statement?: string; judge_vignette?: string; judge_options?: Record<string, string>; has_results?: boolean; split?: "public" | "holdout";
};
export type SayDoVariant = { variant: string; label: string; n: number; counts: Record<string, number>; consistent_rate: number | null; ci95?: [number, number] | null; controls_pass?: number | null; run_id?: string };
export type SayDo = {
  model: string; scenario: string; say_implied_option: string; sample_size_note?: string | null;
  say: { n: number; mean: number | null; scale: string; agree_rate: number | null; dist: Record<string, number>; ci95?: [number, number] | null };
  judge: { n: number; counts: Record<string, number>; consistent_rate: number | null; ci95?: [number, number] | null };
  do: SayDoVariant[]; run_ids?: string[]; view_disagrees_with_statement?: boolean;
};
export type SICondition = { condition: string; label: string; observed: "observed" | "unobserved" | null; direction: string; n: number; counts: Record<string, number>; waive_rate: number; incentive_noticed_rate: number | null;
  self_serving_label?: string | null; self_serving_rate?: number | null; shift?: number | null; shift_p?: number | null; rationalization_rate?: number | null; rationalization_n?: number | null; test_awareness_rate?: number | null; caveat?: string | null };
export type SelfInterest = { model: string; scenario: string; case: string; case_label: string; setup?: string; partial?: boolean; conditions: SICondition[]; observed_vs_unobserved?: Record<string, { unobserved_minus_observed: number; fisher_p: number }> | null };
export type RunInfo = { run_id: string; kind: string; validity: "exploratory" | "superseded" | "excluded"; note?: string | null; family?: string | null; started_utc: string; finished_utc?: string | null; model?: string | null; cost_usd?: number | null; units_public?: number | null };
export type Pressure = { model: string; item: string; arm: string; n: number; flipped: number; recovered: number; flip_rate: number; recovery_rate: number | null };
export type Baseline = { model: string; item: string; instrument: string; foundation?: string | null; statement?: string | null; n: number; answers: Record<string, number>; mean?: number; act_rate?: number; human?: { value: number; label: string; source: string } | null };
export type Foundation = { model: string; instrument: string; foundation: string; scale: [number, number]; model_mean: number; items_scored: number; items_in_scale: number; answers: number;
  human: { mean: number; sd?: number; range?: [number, number]; source: string; url?: string; stat?: string } };
export type Finding = { id: string; pillar: string; model: string; scenario?: string; headline: string; stat: string; stat_label: string; summary: string; bars: { label: string; value: number | null }[]; axis?: string; takeaway?: string };
export type Spend = { total_usd: number; calls: number; by_model: { model: string; provider: string; usd: number; calls: number }[]; by_role: { role: string; usd: number }[]; runs: { run_id: string; mode: string; started_utc: string; usd: number }[] };
export type Bundle = {
  schema_version: number; is_example: boolean; generated_utc: string; source?: string;
  exploratory?: boolean; framing?: string; excluded_graders?: string[]; runs?: RunInfo[];
  models: Model[]; scenarios: (Scenario & { superseded_runs?: { run_id: string; note?: string | null }[] })[]; saydo: SayDo[]; selfinterest: SelfInterest[]; pressure: Pressure[]; baseline: Baseline[]; foundations?: Foundation[]; findings: Finding[]; spend: Spend | null;
};
export type Trace = { model: string; module: string; variant: string; sample: number; label: string | null; prompt: { system?: string | null; user?: string | null; tools?: string[] | null }; reasoning?: string | null; answer?: string | null; tool_calls?: { name: string; input: any }[] | null; split?: string; run_id?: string; validity?: string; prompt_tools?: string[] };
