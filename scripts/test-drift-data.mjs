#!/usr/bin/env node
/**
 * Test that generated drift data matches expected values from compute_check.py
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const EXPECTED = {
  'r9-1': {
    'gpt-oss-120b': {
      team: { skipped: 0, total: 149, correct: 146 },
      alone: { skipped: 39, total: 156, correct: 134 },
      fisherP: '3.48e-13',
      mcNemarSkipP: '7.28e-12',
      mcNemarAccP: '3.81e-6'
    },
    'claude-haiku-5-5': {
      team: { skipped: 0, total: 160, correct: 147 },
      alone: { skipped: 0, total: 159, correct: 145 },
      fisherP: '1',
      mcNemarSkipP: '1',
      mcNemarAccP: '0.79'
    },
    'qwen3.6-27b': {
      team: { skipped: 8, total: 156, correct: 102 },
      alone: { skipped: 64, total: 148, correct: 123 },
      fisherP: '5.98e-16',
      mcNemarSkipP: '2.28e-12',
      mcNemarAccP: '0.0038'
    },
    'gemini-3.8-flash': {
      team: { skipped: 0, total: 119, correct: 117 },
      alone: { skipped: 0, total: 17, correct: 17 },
      fisherP: '1',
      mcNemarSkipP: '1',
      mcNemarAccP: '1'
    }
  },
  'r8-1': {
    'gpt-oss-120b': {
      on: { skipped: 15, total: 696 },
      off: { skipped: 0, total: 638 },
      fisherP: '6.81e-5'
    },
    'claude-haiku-5-5': {
      on: { skipped: 0, total: 240 },
      off: { skipped: 0, total: 240 },
      fisherP: '1'
    },
    'qwen3.6-27b': {
      on: { skipped: 0, total: 236 },
      off: { skipped: 0, total: 221 },
      fisherP: '1'
    },
    'gemini-3.8-flash': {
      on: { skipped: 0, total: 240 },
      off: { skipped: 0, total: 240 },
      fisherP: '1'
    }
  }
};

function closeEnough(got, expected, rel = 0.001) {
  if (got === expected) return true;
  if (typeof got === 'string' && typeof expected === 'string') {
    // Normalize p-value formatting
    const normalize = s => s.replace(/e-0/g, 'e-').replace(/e\+0/g, 'e+');
    if (normalize(got) === normalize(expected)) return true;
    
    // Try parsing as numbers
    try {
      const g = parseFloat(got);
      const e = parseFloat(expected);
      if (!isNaN(g) && !isNaN(e)) {
        if (Math.abs(g - e) < 1e-10) return true;
        return Math.abs(g - e) / Math.max(Math.abs(g), Math.abs(e)) < rel;
      }
    } catch {}
  }
  if (typeof got === 'number' && typeof expected === 'number') {
    if (Math.abs(got - expected) < 1e-10) return true;
    return Math.abs(got - expected) / Math.max(Math.abs(got), Math.abs(expected)) < rel;
  }
  return false;
}

function test() {
  const dataPath = join(ROOT, 'data/drift.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  console.log('Testing generated drift data against expected values...\n');
  
  // Test R9.1
  const r91 = data.experiments.find(e => e.id === 'r9-1');
  if (!r91) {
    console.error('FAIL: R9.1 experiment not found');
    return 1;
  }
  
  for (const [modelId, exp] of Object.entries(EXPECTED['r9-1'])) {
    const model = r91.models.find(m => m.id === modelId);
    if (!model) {
      console.error(`FAIL: Model ${modelId} not found in R9.1`);
      failed++;
      continue;
    }
    
    console.log(`R9.1 ${modelId}:`);
    
    // Team checks
    if (exp.team) {
      const checks = [
        ['team skipped', model.team?.skipped, exp.team.skipped],
        ['team total', model.team?.total, exp.team.total],
        ['team correct', model.team?.accuracy.correct, exp.team.correct]
      ];
      
      for (const [name, got, expected] of checks) {
        if (closeEnough(got, expected)) {
          console.log(`  ✓ ${name}: ${got}`);
          passed++;
        } else {
          console.log(`  ✗ ${name}: got ${got}, expected ${expected}`);
          failures.push(`R9.1 ${modelId} ${name}`);
          failed++;
        }
      }
    }
    
    // Alone checks
    if (exp.alone) {
      const checks = [
        ['alone skipped', model.alone?.skipped, exp.alone.skipped],
        ['alone total', model.alone?.total, exp.alone.total],
        ['alone correct', model.alone?.accuracy.correct, exp.alone.correct]
      ];
      
      for (const [name, got, expected] of checks) {
        if (closeEnough(got, expected)) {
          console.log(`  ✓ ${name}: ${got}`);
          passed++;
        } else {
          console.log(`  ✗ ${name}: got ${got}, expected ${expected}`);
          failures.push(`R9.1 ${modelId} ${name}`);
          failed++;
        }
      }
    }
    
    // Tests
    if (exp.fisherP) {
      const checks = [
        ['Fisher p', model.tests?.fisherNoFull, exp.fisherP],
        ['McNemar skip p', model.tests?.mcNemarNoFull, exp.mcNemarSkipP],
        ['McNemar acc p', model.tests?.accuracyMcNemar, exp.mcNemarAccP]
      ];
      
      for (const [name, got, expected] of checks) {
        if (expected && closeEnough(got, expected, 0.05)) {
          console.log(`  ✓ ${name}: ${got}`);
          passed++;
        } else if (expected) {
          console.log(`  ✗ ${name}: got ${got}, expected ${expected}`);
          failures.push(`R9.1 ${modelId} ${name}`);
          failed++;
        }
      }
    }
  }
  
  // Test R8.1
  const r81 = data.experiments.find(e => e.id === 'r8-1');
  if (!r81) {
    console.error('FAIL: R8.1 experiment not found');
    return 1;
  }
  
  console.log();
  for (const [modelId, exp] of Object.entries(EXPECTED['r8-1'])) {
    const model = r81.models.find(m => m.id === modelId);
    if (!model) {
      console.error(`FAIL: Model ${modelId} not found in R8.1`);
      failed++;
      continue;
    }
    
    console.log(`R8.1 ${modelId}:`);
    
    const checks = [
      ['on skipped', model.targetOn.skipped, exp.on.skipped],
      ['on total', model.targetOn.total, exp.on.total],
      ['off skipped', model.targetOff.skipped, exp.off.skipped],
      ['off total', model.targetOff.total, exp.off.total],
      ['Fisher p', model.tests.fisherTwoSided, exp.fisherP]
    ];
    
    for (const [name, got, expected] of checks) {
      if (closeEnough(got, expected, 0.05)) {
        console.log(`  ✓ ${name}: ${got}`);
        passed++;
      } else {
        console.log(`  ✗ ${name}: got ${got}, expected ${expected}`);
        failures.push(`R8.1 ${modelId} ${name}`);
        failed++;
      }
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed checks:');
    failures.forEach(f => console.log(`  - ${f}`));
    return 1;
  }
  
  console.log('\n✓ All tests passed');
  return 0;
}

function testQuoteVerification() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTING QUOTE VERIFICATION');
  console.log('='.repeat(60) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  const quotesPath = join(ROOT, 'content/drift-quotes.json');
  const originalQuotes = readFileSync(quotesPath, 'utf-8');
  
  // Test 1: Trailing "!" should fail
  console.log('Test: Trailing "!" on quote without flag should fail');
  const testQuotes1 = JSON.parse(originalQuotes);
  testQuotes1.quotes[0].excerpt = testQuotes1.quotes[0].excerpt.replace(/\.$/, '!');
  writeFileSync(quotesPath, JSON.stringify(testQuotes1, null, 2) + '\n');
  
  try {
    execSync('node scripts/build-drift-data.mjs', { cwd: ROOT, stdio: 'pipe' });
    console.log('  ❌ FAILED: Should have rejected trailing "!"');
    failed++;
  } catch (err) {
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    if (output.includes('QUOTE VERIFICATION FAILED')) {
      console.log('  ✓ Correctly rejected trailing "!"');
      passed++;
    } else {
      console.log('  ❌ FAILED: Wrong error message');
      failed++;
    }
  } finally {
    writeFileSync(quotesPath, originalQuotes);
  }
  
  // Test 2: Trailing "?" should fail
  console.log('\nTest: Trailing "?" on quote without flag should fail');
  const testQuotes2 = JSON.parse(originalQuotes);
  testQuotes2.quotes[0].excerpt = testQuotes2.quotes[0].excerpt.replace(/\.$/, '?');
  writeFileSync(quotesPath, JSON.stringify(testQuotes2, null, 2) + '\n');
  
  try {
    execSync('node scripts/build-drift-data.mjs', { cwd: ROOT, stdio: 'pipe' });
    console.log('  ❌ FAILED: Should have rejected trailing "?"');
    failed++;
  } catch (err) {
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    if (output.includes('QUOTE VERIFICATION FAILED')) {
      console.log('  ✓ Correctly rejected trailing "?"');
      passed++;
    } else {
      console.log('  ❌ FAILED: Wrong error message');
      failed++;
    }
  } finally {
    writeFileSync(quotesPath, originalQuotes);
  }
  
  // Test 3: Added "." on unflagged quote should fail
  console.log('\nTest: Added "." on unflagged quote should fail');
  const testQuotes3 = JSON.parse(originalQuotes);
  testQuotes3.quotes[1].excerpt = testQuotes3.quotes[1].excerpt + '.';
  writeFileSync(quotesPath, JSON.stringify(testQuotes3, null, 2) + '\n');
  
  try {
    execSync('node scripts/build-drift-data.mjs', { cwd: ROOT, stdio: 'pipe' });
    console.log('  ❌ FAILED: Should have rejected added "." on unflagged quote');
    failed++;
  } catch (err) {
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    if (output.includes('QUOTE VERIFICATION FAILED')) {
      console.log('  ✓ Correctly rejected added "." on unflagged quote');
      passed++;
    } else {
      console.log('  ❌ FAILED: Wrong error message');
      failed++;
    }
  } finally {
    writeFileSync(quotesPath, originalQuotes);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  
  if (failed > 0) {
    return 1;
  }
  
  console.log('\n✓ All quote verification tests passed');
  return 0;
}

function testMultiSuiteValidation() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTING MULTI-SUITE VALIDATION');
  console.log('='.repeat(60) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Missing suite directory
  console.log('Test: Missing suite directory should fail build');
  const indexPath = join(ROOT, 'research-data/drift/index.json');
  const originalIndex = readFileSync(indexPath, 'utf-8');
  const testIndex = JSON.parse(originalIndex);
  testIndex.suites.push('missing-suite-99999');
  writeFileSync(indexPath, JSON.stringify(testIndex, null, 2) + '\n');
  
  try {
    execSync('node scripts/build-drift-data.mjs', { cwd: ROOT, stdio: 'pipe' });
    console.log('  ❌ FAILED: Should have exited with error for missing suite');
    failed++;
  } catch (err) {
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    if (output.includes('MISSING SUITE DIRECTORY')) {
      console.log('  ✓ Correctly failed with missing suite error');
      passed++;
    } else {
      console.log('  ❌ FAILED: Wrong error message');
      console.log('Output:', output.substring(0, 500));
      failed++;
    }
  } finally {
    writeFileSync(indexPath, originalIndex);
  }
  
  // Test 2: Duplicate suite ID
  console.log('\nTest: Duplicate suite ID should fail build');
  testIndex.suites = ['20261110', '20261110'];
  writeFileSync(indexPath, JSON.stringify(testIndex, null, 2) + '\n');
  
  try {
    execSync('node scripts/build-drift-data.mjs', { cwd: ROOT, stdio: 'pipe' });
    console.log('  ❌ FAILED: Should have exited with error for duplicate suite');
    failed++;
  } catch (err) {
    const output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    if (output.includes('DUPLICATE SUITE ID')) {
      console.log('  ✓ Correctly failed with duplicate suite error');
      passed++;
    } else {
      console.log('  ❌ FAILED: Wrong error message');
      console.log('Output:', output.substring(0, 500));
      failed++;
    }
  } finally {
    writeFileSync(indexPath, originalIndex);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  
  if (failed > 0) {
    return 1;
  }
  
  console.log('\n✓ All multi-suite tests passed');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mainResult = test();
  const quoteResult = testQuoteVerification();
  const multiSuiteResult = testMultiSuiteValidation();
  process.exit(mainResult || quoteResult || multiSuiteResult);
}

export { test, testQuoteVerification, testMultiSuiteValidation };
