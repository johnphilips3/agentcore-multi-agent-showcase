#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Test validation configuration
const TEST_PATTERNS = {
  unit: 'src/**/*.test.ts',
  integration: 'src/__tests__/integration/**/*.test.ts',
  performance: 'src/__tests__/performance/**/*.test.ts'
};

const REQUIRED_IMPORTS = [
  'describe',
  'it',
  'expect',
  'beforeEach',
  'afterEach'
];

const VITEST_IMPORTS = [
  'vi',
  'vitest'
];

function findTestFiles(pattern) {
  const files = [];
  
  function walkDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  // Determine starting directory based on pattern
  if (pattern.includes('integration')) {
    walkDir('src/__tests__/integration');
  } else if (pattern.includes('performance')) {
    walkDir('src/__tests__/performance');
  } else {
    walkDir('src');
    // Filter out integration and performance tests for unit tests
    return files.filter(file => 
      !file.includes('integration') && 
      !file.includes('performance')
    );
  }
  
  return files;
}

function validateTestFile(filePath) {
  const issues = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for required test structure
    if (!content.includes('describe(')) {
      issues.push('Missing describe() blocks');
    }
    
    if (!content.includes('it(') && !content.includes('test(')) {
      issues.push('Missing it() or test() blocks');
    }
    
    if (!content.includes('expect(')) {
      issues.push('Missing expect() assertions');
    }
    
    // Check for proper imports
    const hasVitestImport = VITEST_IMPORTS.some(imp => 
      content.includes(`import { ${imp}`) || 
      content.includes(`import ${imp}`) ||
      content.includes(`from 'vitest'`)
    );
    
    if (!hasVitestImport) {
      issues.push('Missing vitest imports');
    }
    
    // Check for mock cleanup
    if (content.includes('vi.fn()') || content.includes('vi.mock(')) {
      if (!content.includes('vi.clearAllMocks()') && 
          !content.includes('beforeEach') && 
          !content.includes('afterEach')) {
        issues.push('Mock functions used but no cleanup detected');
      }
    }
    
    // Check for async/await patterns (more lenient check)
    const asyncTests = content.match(/it\s*\(\s*['"`][^'"`]*['"`]\s*,\s*async/g);
    if (asyncTests && asyncTests.length > 0) {
      // Only flag if there are async tests but no await at all
      if (!content.includes('await ')) {
        issues.push('Async tests detected but no await statements found');
      }
    }
    
  } catch (error) {
    issues.push(`Failed to read file: ${error.message}`);
  }
  
  return issues;
}

function validateTestConfiguration() {
  console.log('🔍 Validating test configuration...\n');
  
  let totalFiles = 0;
  let totalIssues = 0;
  const results = {};
  
  // Validate each test type
  Object.entries(TEST_PATTERNS).forEach(([testType, pattern]) => {
    console.log(`📁 Checking ${testType} tests (${pattern}):`);
    
    const files = findTestFiles(pattern);
    totalFiles += files.length;
    
    if (files.length === 0) {
      console.log(`   ⚠️  No test files found`);
      results[testType] = { files: 0, issues: 0 };
      return;
    }
    
    let typeIssues = 0;
    
    files.forEach(file => {
      const issues = validateTestFile(file);
      
      if (issues.length > 0) {
        console.log(`   ❌ ${file}:`);
        issues.forEach(issue => {
          console.log(`      - ${issue}`);
          typeIssues++;
          totalIssues++;
        });
      } else {
        console.log(`   ✅ ${file}`);
      }
    });
    
    results[testType] = { files: files.length, issues: typeIssues };
    console.log(`   📊 ${files.length} files, ${typeIssues} issues\n`);
  });
  
  // Summary
  console.log('📋 Summary:');
  console.log(`   Total test files: ${totalFiles}`);
  console.log(`   Total issues: ${totalIssues}`);
  
  Object.entries(results).forEach(([testType, stats]) => {
    console.log(`   ${testType}: ${stats.files} files, ${stats.issues} issues`);
  });
  
  // Check for configuration files
  console.log('\n🔧 Configuration files:');
  const configFiles = [
    'vitest.config.ts',
    'vitest.integration.config.ts',
    'vitest.performance.config.ts',
    'src/__tests__/test-setup.ts'
  ];
  
  configFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`   ✅ ${file}`);
    } else {
      console.log(`   ❌ ${file} (missing)`);
      totalIssues++;
    }
  });
  
  // Exit with appropriate code
  if (totalIssues > 0) {
    console.log(`\n❌ Validation failed with ${totalIssues} issues`);
    process.exit(1);
  } else {
    console.log('\n✅ All tests are properly configured');
    process.exit(0);
  }
}

// Run validation
validateTestConfiguration();