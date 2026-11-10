#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Supermarket Till Backend...\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), 'env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env file from env.example');
  } else {
    console.log('❌ env.example file not found');
    process.exit(1);
  }
} else {
  console.log('✅ .env file already exists');
}

// Check if node_modules exists
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing dependencies...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.log('❌ Failed to install dependencies');
    process.exit(1);
  }
} else {
  console.log('✅ Dependencies already installed');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Update your .env file with your database credentials');
console.log('2. Make sure PostgreSQL is running');
console.log('3. Create a database named "till_pos"');
console.log('4. Run: npm run start:dev');
console.log('\n🔗 The application will be available at: http://localhost:4000/api');
console.log('\n👤 Default Super Admin credentials:');
console.log('   Email: admin@till.local');
console.log('   Password: SuperAdmin@123');
