#!/usr/bin/env node
/**
 * Generate data/cost-estimates.json from measured token usage and model prices.
 * Computes per-model cost estimates for the funding queue based on measured runs.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/**
 * Compute the cost basis: max input and max output tokens across all complete runs.
 */
function computeBasis(measuredData) {
  const runs = Object.values(measuredData.complete_runs);
  if (runs.length === 0) {
    throw new Error('No complete runs found in measured token data');
  }
  
  const maxInput = Math.max(...runs.map(r => r.input_tokens));
  const maxOutput = Math.max(...runs.map(r => r.output_tokens));
  
  return {
    input_tokens: maxInput,
    output_tokens: maxOutput,
    note: 'Most verbose complete run (max input and max output across all complete runs)'
  };
}

/**
 * Compute cost estimate for a model given its pricing and the token basis.
 */
function computeCost(modelPrice, basis, config) {
  const inputCost = (basis.input_tokens / 1_000_000) * modelPrice.input_price_per_1m;
  const outputCost = (basis.output_tokens / 1_000_000) * modelPrice.output_price_per_1m;
  const tokenCost = inputCost + outputCost;
  const withMargin = tokenCost * config.safety_margin;
  const withGrader = withMargin + config.max_grader_cost_usd;
  const rounded = Math.ceil(withGrader);
  
  return {
    token_cost_usd: tokenCost,
    with_margin_usd: withMargin,
    with_grader_usd: withGrader,
    estimate_usd: rounded,
    breakdown: {
      input_cost: inputCost,
      output_cost: outputCost,
      margin_multiplier: config.safety_margin,
      grader_cost: config.max_grader_cost_usd
    }
  };
}

/**
 * Generate cost estimates for all models in milestones.json.
 */
function generate() {
  // Load input data
  const measuredPath = join(ROOT, 'research-data/costs/measured-full-v1-tokens.json');
  const measured = JSON.parse(readFileSync(measuredPath, 'utf-8'));
  
  const pricesPath = join(ROOT, 'data/model-prices.json');
  const pricesData = JSON.parse(readFileSync(pricesPath, 'utf-8'));
  
  const milestonesPath = join(ROOT, 'data/milestones.json');
  const milestones = JSON.parse(readFileSync(milestonesPath, 'utf-8'));
  
  // Compute the token basis
  const basis = computeBasis(measured);
  
  // Build a lookup map for prices
  const priceMap = new Map();
  for (const price of pricesData.prices) {
    priceMap.set(price.model_id, price);
  }
  
  // Compute estimates for each model milestone
  const estimates = [];
  const missing = [];
  
  for (const milestone of milestones.milestones) {
    if (milestone.kind !== 'model') {
      // Scenario milestones are not auto-computed
      continue;
    }
    
    const price = priceMap.get(milestone.model_id);
    if (!price) {
      missing.push(milestone.model_id);
      continue;
    }
    
    const cost = computeCost(price, basis, pricesData.cost_computation);
    
    estimates.push({
      key: milestone.key,
      model_id: milestone.model_id,
      lab: milestone.lab,
      title: milestone.title,
      estimate_usd: cost.estimate_usd,
      computation: {
        basis_input_tokens: basis.input_tokens,
        basis_output_tokens: basis.output_tokens,
        ...cost.breakdown
      },
      price_source: price.source,
      price_as_of: price.as_of
    });
  }
  
  // Fail if any model is missing a price
  if (missing.length > 0) {
    console.error('\n❌ MISSING PRICES\n');
    console.error(`The following models in milestones.json lack prices in model-prices.json:\n`);
    for (const id of missing) {
      console.error(`  - ${id}`);
    }
    console.error('\nAdd prices for these models to data/model-prices.json\n');
    process.exit(1);
  }
  
  // Write output
  const output = {
    generated: new Date().toISOString(),
    source: 'research-data/costs/measured-full-v1-tokens.json',
    basis,
    config: pricesData.cost_computation,
    estimates
  };
  
  const outPath = join(ROOT, 'data/cost-estimates.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  
  console.log(`Generated ${outPath} with ${estimates.length} model estimates`);
  console.log(`Basis: ${basis.input_tokens.toLocaleString()} input + ${basis.output_tokens.toLocaleString()} output tokens`);
  
  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generate();
}

export { generate, computeBasis, computeCost };
