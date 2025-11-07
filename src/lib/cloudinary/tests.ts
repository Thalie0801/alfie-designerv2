/**
 * Phase 6: Testing & Validation
 * 
 * Basic tests for the new Cloudinary architecture
 * Run these manually to verify everything works
 */

import { ping, sign } from './upload';
import { slideUrl } from './imageUrls';
import { reelUrl } from './videoUrls';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

/**
 * Test 1: Cloudinary health check
 */
export async function testCloudinaryPing(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await ping();
    const duration = Date.now() - start;
    
    if (result.ok) {
      return {
        name: 'Cloudinary Ping',
        passed: true,
        message: `Health check passed at ${result.timestamp}`,
        duration
      };
    } else {
      return {
        name: 'Cloudinary Ping',
        passed: false,
        message: 'Ping returned ok: false',
        duration
      };
    }
  } catch (error: any) {
    return {
      name: 'Cloudinary Ping',
      passed: false,
      message: `Error: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 2: Signature generation
 */
export async function testSignGeneration(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await sign({
      folder: 'test',
      resource_type: 'image',
      tags: ['test']
    });
    const duration = Date.now() - start;
    
    if (result.signature && result.timestamp && result.api_key && result.cloud_name) {
      return {
        name: 'Sign Generation',
        passed: true,
        message: `Generated signature successfully (cloud: ${result.cloud_name})`,
        duration
      };
    } else {
      return {
        name: 'Sign Generation',
        passed: false,
        message: 'Missing required fields in signature response',
        duration
      };
    }
  } catch (error: any) {
    return {
      name: 'Sign Generation',
      passed: false,
      message: `Error: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 3: Image URL generation
 */
export function testImageUrlGeneration(): TestResult {
  const start = Date.now();
  try {
    const url = slideUrl('test/sample', {
      title: 'Test Title',
      subtitle: 'Test Subtitle',
      bulletPoints: ['Point 1', 'Point 2'],
      width: 1080,
      height: 1920,
      aspectRatio: '9:16'
    });
    const duration = Date.now() - start;
    
    if (url && url.includes('cloudinary.com') && url.includes('test/sample')) {
      return {
        name: 'Image URL Generation',
        passed: true,
        message: `Generated valid URL: ${url.substring(0, 100)}...`,
        duration
      };
    } else {
      return {
        name: 'Image URL Generation',
        passed: false,
        message: 'Invalid URL generated',
        duration
      };
    }
  } catch (error: any) {
    return {
      name: 'Image URL Generation',
      passed: false,
      message: `Error: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 4: Video URL generation
 */
export function testVideoUrlGeneration(): TestResult {
  const start = Date.now();
  try {
    const url = reelUrl('test/sample_video', {
      title: 'Test Video',
      subtitle: 'Test Description',
      start: 5,
      duration: 10,
      aspectRatio: '9:16'
    });
    const duration = Date.now() - start;
    
    if (url && url.includes('cloudinary.com') && url.includes('test/sample_video')) {
      return {
        name: 'Video URL Generation',
        passed: true,
        message: `Generated valid URL: ${url.substring(0, 100)}...`,
        duration
      };
    } else {
      return {
        name: 'Video URL Generation',
        passed: false,
        message: 'Invalid URL generated',
        duration
      };
    }
  } catch (error: any) {
    return {
      name: 'Video URL Generation',
      passed: false,
      message: `Error: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 5: Naming convention validation
 */
export function testNamingConvention(): TestResult {
  const start = Date.now();
  try {
    const brandId = 'brand_123';
    const campaignId = 'campaign_456';
    const slideIndex = 1;
    
    const expectedFolder = `alfie/${brandId}/${campaignId}/slides`;
    const expectedPublicId = `slide_${String(slideIndex).padStart(2, '0')}`;
    const fullPath = `${expectedFolder}/${expectedPublicId}`;
    
    const url = slideUrl(fullPath, {
      title: 'Test',
      aspectRatio: '9:16'
    });
    const duration = Date.now() - start;
    
    if (url.includes(expectedFolder) && url.includes(expectedPublicId)) {
      return {
        name: 'Naming Convention',
        passed: true,
        message: `Correct structure: ${fullPath}`,
        duration
      };
    } else {
      return {
        name: 'Naming Convention',
        passed: false,
        message: 'Naming convention not respected in URL',
        duration
      };
    }
  } catch (error: any) {
    return {
      name: 'Naming Convention',
      passed: false,
      message: `Error: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<TestResult[]> {
  console.log('🧪 Running Cloudinary architecture tests...\n');
  
  const results: TestResult[] = [];
  
  // Test 1: Ping
  console.log('Running: Cloudinary Ping...');
  results.push(await testCloudinaryPing());
  
  // Test 2: Sign
  console.log('Running: Sign Generation...');
  results.push(await testSignGeneration());
  
  // Test 3: Image URL
  console.log('Running: Image URL Generation...');
  results.push(testImageUrlGeneration());
  
  // Test 4: Video URL
  console.log('Running: Video URL Generation...');
  results.push(testVideoUrlGeneration());
  
  // Test 5: Naming Convention
  console.log('Running: Naming Convention...');
  results.push(testNamingConvention());
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${results.length}`);
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`\n${icon} ${result.name} (${result.duration}ms)`);
    console.log(`   ${result.message}`);
  });
  
  return results;
}

/**
 * Helper: Log test results in a nice format
 */
export function formatTestResults(results: TestResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  let output = '=== Cloudinary Tests ===\n\n';
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    output += `${icon} ${result.name} (${result.duration}ms)\n`;
    output += `   ${result.message}\n\n`;
  });
  
  output += `\nSummary: ${passed} passed, ${failed} failed (${results.length} total)`;
  
  return output;
}
