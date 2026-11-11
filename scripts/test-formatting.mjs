#!/usr/bin/env node
/**
 * Test usd() and queueUsd() formatting functions.
 */

// Replicate the formatting functions to test logic without dependencies
const usd = (cents, digits = 2) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const queueUsd = (cents) => {
  const dollars = cents / 100;
  const isWholeDollar = cents % 100 === 0;
  const digits = (dollars < 20 || !isWholeDollar) ? 2 : 0;
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
  
  // Test 3: queueUsd() shows cents when value < $20 or not a whole dollar
  console.log('Test 3: queueUsd() shows cents when value < $20 or not a whole dollar');
  const tests3 = [
    [129, '$1.29'],      // gpt-oss-120b actual (< $20)
    [1066, '$10.66'],    // Gemini 3.8 Flash actual (< $20)
    [1908, '$19.08'],    // GPT-6.1 Sol partial funding example (< $20)
    [3800, '$38'],       // Grok 4.7 (≥$20, whole dollar, no cents)
    [5600, '$56'],       // Claude Sonnet 5.5 (≥$20, whole dollar, no cents)
    [0, '$0.00'],        // Zero shows cents
    [1999, '$19.99'],    // Just under $20
    [2000, '$20'],       // Exactly $20, whole dollar, no cents
    [3692, '$36.92'],    // $36.92 (≥$20 but not whole, show cents)
    [5650, '$56.50']     // $56.50 (≥$20 but not whole, show cents)
  ];
  
  for (const [cents, expected] of tests3) {
    const result = queueUsd(cents);
    if (result !== expected) {
      console.error(`❌ FAIL: queueUsd(${cents}) = "${result}", expected "${expected}"`);
      process.exit(1);
    }
  }
  console.log('✓ All queueUsd() tests passed\n');
  
  // Test 4: Remaining amount formatting (non-whole dollars show cents)
  console.log('Test 4: Remaining amount shows cents for non-whole dollars');
  const tests4 = [
    [3692, '$36.92'],    // $36.92 remaining (not whole, show cents)
    [129, '$1.29'],      // $1.29 remaining (< $20)
    [3800, '$38'],       // Whole dollar, no cents
    [5600, '$56'],       // Whole dollar over $20, no cents
    [5650, '$56.50']     // $56.50 (not whole, show cents)
  ];
  
  for (const [cents, expected] of tests4) {
    const result = queueUsd(cents);
    if (result !== expected) {
      console.error(`❌ FAIL: queueUsd(${cents}) for remaining = "${result}", expected "${expected}"`);
      process.exit(1);
    }
  }
  console.log('✓ All remaining amount tests passed\n');
  
  // Test 5: Homepage queue preview logic (items after next, not from start)
  console.log('Test 5: Queue preview shows items after next unfunded milestone');
  const mockQueue = [
    { key: 'grok', title: 'Grok', status: 'funded', position: 1 },
    { key: 'gpt-oss', title: 'gpt-oss', status: 'funded', position: 2 },
    { key: 'sonnet', title: 'Sonnet', status: 'funded', position: 3 },
    { key: 'sol', title: 'Sol', status: 'queued', position: 4 },
    { key: 'scenarios', title: 'Scenarios', status: 'queued', position: 5 },
    { key: 'deepseek', title: 'DeepSeek', status: 'queued', position: 6 }
  ];
  
  const next = mockQueue.find(m => m.status === 'queued'); // Sol
  const nextIndex = next ? mockQueue.findIndex(m => m.key === next.key) : -1;
  const startIndex = nextIndex >= 0 ? nextIndex + 1 : 1;
  const showQueue = 3;
  const preview = mockQueue.slice(startIndex, startIndex + showQueue);
  
  if (preview.length !== 2) {
    console.error(`❌ FAIL: Preview should have 2 items (Scenarios, DeepSeek), got ${preview.length}`);
    process.exit(1);
  }
  if (preview[0].key !== 'scenarios' || preview[1].key !== 'deepseek') {
    console.error(`❌ FAIL: Preview should show Scenarios and DeepSeek, got ${preview.map(m => m.key).join(', ')}`);
    process.exit(1);
  }
  if (startIndex + 1 !== 5) {
    console.error(`❌ FAIL: First preview item should be numbered 05 (position 5), got ${startIndex + 1}`);
    process.exit(1);
  }
  console.log('✓ Queue preview correctly starts after next unfunded milestone\n');
  
  console.log('✅ All formatting tests passed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  test();
}

export { test };
