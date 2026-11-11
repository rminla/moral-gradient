#!/usr/bin/env node
/**
 * Test that cost estimates are computed correctly from measured token usage.
 * Recomputes one model (Grok 4.7) by hand and fails if the build data disagrees.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function test() {
  console.log('Testing cost estimates computation...\n');
  
  // Load the generated estimates
  const estimatesPath = join(ROOT, 'data/cost-estimates.json');
  const estimates = JSON.parse(readFileSync(estimatesPath, 'utf-8'));
  
  // Load the measured tokens
  const measuredPath = join(ROOT, 'research-data/costs/measured-full-v1-tokens.json');
  const measured = JSON.parse(readFileSync(measuredPath, 'utf-8'));
  
  // Load the model prices
  const pricesPath = join(ROOT, 'data/model-prices.json');
  const prices = JSON.parse(readFileSync(pricesPath, 'utf-8'));
  
  // Test 1: Verify basis computation
  console.log('Test 1: Verify basis computation');
  const runs = Object.values(measured.complete_runs);
  const expectedMaxInput = Math.max(...runs.map(r => r.input_tokens));
  const expectedMaxOutput = Math.max(...runs.map(r => r.output_tokens));
  
  if (estimates.basis.input_tokens !== expectedMaxInput) {
    console.error(`❌ FAIL: Basis input tokens mismatch`);
    console.error(`  Expected: ${expectedMaxInput}`);
    console.error(`  Got: ${estimates.basis.input_tokens}`);
    process.exit(1);
  }
  
  if (estimates.basis.output_tokens !== expectedMaxOutput) {
    console.error(`❌ FAIL: Basis output tokens mismatch`);
    console.error(`  Expected: ${expectedMaxOutput}`);
    console.error(`  Got: ${estimates.basis.output_tokens}`);
    process.exit(1);
  }
  
  console.log(`✓ Basis: ${expectedMaxInput.toLocaleString()} input + ${expectedMaxOutput.toLocaleString()} output tokens\n`);
  
  // Test 2: Recompute Grok 4.7 cost by hand
  console.log('Test 2: Recompute Grok 4.7 cost');
  const grokPrice = prices.prices.find(p => p.model_id === 'grok-4.7');
  if (!grokPrice) {
    console.error('❌ FAIL: Grok 4.7 price not found');
    process.exit(1);
  }
  
  const inputCost = (estimates.basis.input_tokens / 1_000_000) * grokPrice.input_price_per_1m;
  const outputCost = (estimates.basis.output_tokens / 1_000_000) * grokPrice.output_price_per_1m;
  const tokenCost = inputCost + outputCost;
  const withMargin = tokenCost * prices.cost_computation.safety_margin;
  const withGrader = withMargin + prices.cost_computation.max_grader_cost_usd;
  const rounded = Math.ceil(withGrader);
  
  console.log(`  Input cost: $${inputCost.toFixed(4)} (${estimates.basis.input_tokens.toLocaleString()} tokens × $${grokPrice.input_price_per_1m}/1M)`);
  console.log(`  Output cost: $${outputCost.toFixed(4)} (${estimates.basis.output_tokens.toLocaleString()} tokens × $${grokPrice.output_price_per_1m}/1M)`);
  console.log(`  Token cost: $${tokenCost.toFixed(4)}`);
  console.log(`  With ${prices.cost_computation.safety_margin}x margin: $${withMargin.toFixed(4)}`);
  console.log(`  With grader ($${prices.cost_computation.max_grader_cost_usd}): $${withGrader.toFixed(4)}`);
  console.log(`  Rounded up: $${rounded}`);
  
  const grokEstimate = estimates.estimates.find(e => e.model_id === 'grok-4.7');
  if (!grokEstimate) {
    console.error('❌ FAIL: Grok 4.7 estimate not found in generated data');
    process.exit(1);
  }
  
  if (grokEstimate.estimate_usd !== rounded) {
    console.error(`❌ FAIL: Grok 4.7 estimate mismatch`);
    console.error(`  Hand-computed: $${rounded}`);
    console.error(`  Generated: $${grokEstimate.estimate_usd}`);
    process.exit(1);
  }
  
  console.log(`✓ Generated estimate matches: $${grokEstimate.estimate_usd}\n`);
  
  // Test 3: Verify milestones.json uses generated estimates or actuals
  console.log('Test 3: Verify milestones.json uses generated estimates or actuals');
  const milestonesPath = join(ROOT, 'data/milestones.json');
  const milestones = JSON.parse(readFileSync(milestonesPath, 'utf-8'));
  
  let mismatchCount = 0;
  let actualCount = 0;
  let estimateCount = 0;
  
  for (const milestone of milestones.milestones) {
    if (milestone.kind !== 'model') {
      continue;
    }
    
    // Check if this is an actual or an estimate
    const actual = estimates.actuals.find(a => a.key === milestone.key);
    const estimate = estimates.estimates.find(e => e.key === milestone.key);
    
    // milestones.json uses cost_usd, we need to compare in dollars
    if (actual) {
      // Model has been run - verify it uses the actual cost
      const expectedUsd = actual.actual_cost_usd;
      if (Math.abs(milestone.cost_usd - expectedUsd) > 0.01) {
        console.log(`  ⚠ ${milestone.key}: milestones.json has $${milestone.cost_usd}, actual is $${expectedUsd}`);
        mismatchCount++;
      } else {
        actualCount++;
      }
    } else if (estimate) {
      // Model hasn't been run - verify it uses the estimate
      const expectedUsd = estimate.estimate_usd;
      if (milestone.cost_usd !== expectedUsd) {
        console.log(`  ⚠ ${milestone.key}: milestones.json has $${milestone.cost_usd}, estimate is $${expectedUsd}`);
        mismatchCount++;
      } else {
        estimateCount++;
      }
    } else {
      console.error(`❌ FAIL: No estimate or actual found for ${milestone.key}`);
      process.exit(1);
    }
  }
  
  if (mismatchCount > 0) {
    console.error(`\n❌ FAIL: ${mismatchCount} milestone(s) have costs that don't match`);
    console.error('Update milestones.json to use the generated estimates/actuals.');
    process.exit(1);
  }
  
  console.log(`✓ ${actualCount} models use actual costs, ${estimateCount} use estimates\n`);
  
  // Test 4: Verify all queue models have prices
  console.log('Test 4: Verify all queue models have prices');
  const priceMap = new Map(prices.prices.map(p => [p.model_id, p]));
  let missingCount = 0;
  
  for (const milestone of milestones.milestones) {
    if (milestone.kind !== 'model') {
      continue;
    }
    
    if (!priceMap.has(milestone.model_id)) {
      console.error(`  ❌ Missing price for ${milestone.model_id}`);
      missingCount++;
    }
  }
  
  if (missingCount > 0) {
    console.error(`\n❌ FAIL: ${missingCount} model(s) lack prices in model-prices.json`);
    process.exit(1);
  }
  
  console.log(`✓ All ${milestones.milestones.filter(m => m.kind === 'model').length} models have prices\n`);
  
  // Test 5: Verify actuals are not overwritten by estimates
  console.log('Test 5: Verify actuals are not overwritten');
  const priceMapWithActuals = new Map(prices.prices.map(p => [p.model_id, p]));
  
  for (const actual of estimates.actuals) {
    const price = priceMapWithActuals.get(actual.model_id);
    if (!price || price.actual_cost_usd == null) {
      console.error(`❌ FAIL: Actual for ${actual.model_id} is missing from model-prices.json`);
      process.exit(1);
    }
    
    // Verify the actual wasn't turned into an estimate
    const wrongEstimate = estimates.estimates.find(e => e.model_id === actual.model_id);
    if (wrongEstimate) {
      console.error(`❌ FAIL: ${actual.model_id} has both actual and estimate - actuals must not be overwritten`);
      process.exit(1);
    }
  }
  
  console.log(`✓ ${estimates.actuals.length} actual(s) preserved, not overwritten by estimates\n`);
  
  console.log('✅ All cost estimate tests passed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  test();
}

export { test };
