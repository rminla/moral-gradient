#!/usr/bin/env node
/**
 * Test usd() and queueUsd() formatting functions.
 */

// Replicate the formatting functions to test logic without dependencies
const usd = (cents, digits = 2) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const queueUsd = (cents) => {
  const dollars = cents / 100;
  const digits = dollars < 20 ? 2 : 0;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

function test() {
  console.log('Testing formatting functions...\n');
  
  // Test 1: usd() default behavior (2 decimals)
  console.log('Test 1: usd() shows 2 decimals by default');
  const tests1 = [
    [8563, '$85.63'],
    [11437, '$114.37'],
    [3692, '$36.92'],
    [129, '$1.29'],
    [1066, '$10.66'],
    [5600, '$56.00']
  ];
  
  for (const [cents, expected] of tests1) {
    const result = usd(cents);
    if (result !== expected) {
      console.error(`❌ FAIL: usd(${cents}) = "${result}", expected "${expected}"`);
      process.exit(1);
    }
  }
  console.log('✓ All usd() default tests passed\n');
  
  // Test 2: usd() with explicit digits
  console.log('Test 2: usd() respects explicit digits parameter');
  const tests2 = [
    [8563, 0, '$86'],
    [11437, 0, '$114'],
    [129, 0, '$1'],
    [1066, 0, '$11']
  ];
  
  for (const [cents, digits, expected] of tests2) {
    const result = usd(cents, digits);
    if (result !== expected) {
      console.error(`❌ FAIL: usd(${cents}, ${digits}) = "${result}", expected "${expected}"`);
      process.exit(1);
    }
  }
  console.log('✓ All usd() explicit digits tests passed\n');
  
  // Test 3: queueUsd() shows cents for values under $20
  console.log('Test 3: queueUsd() shows cents when value < $20, whole dollars otherwise');
  const tests3 = [
    [129, '$1.29'],      // gpt-oss-120b actual
    [1066, '$10.66'],    // Gemini 3.8 Flash actual
    [1908, '$19.08'],    // GPT-6.1 Sol partial funding example
    [3800, '$38'],       // Grok 4.7 (≥$20, no cents)
    [5600, '$56'],       // Claude Sonnet 5.5 (≥$20, no cents)
    [0, '$0.00'],        // Zero shows cents
    [1999, '$19.99'],    // Just under $20
    [2000, '$20']        // Exactly $20, no cents
  ];
  
  for (const [cents, expected] of tests3) {
    const result = queueUsd(cents);
    if (result !== expected) {
      console.error(`❌ FAIL: queueUsd(${cents}) = "${result}", expected "${expected}"`);
      process.exit(1);
    }
  }
  console.log('✓ All queueUsd() tests passed\n');
  
  console.log('✅ All formatting tests passed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  test();
}

export { test };
