/**
 * Main server entry point for Alpaca Herd Management API
 */
import { config } from 'dotenv';
import { createAndStartFullServer } from './api/full-server.js';

// Load environment variables
config();

async function main() {
  try {
    console.log('🦙 Starting Alpaca Herd Management API...');
    
    // Log configuration
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Port:', process.env.PORT || 3000);
    
    if (process.env.RDS_HOST) {
      console.log('Database: RDS -', process.env.RDS_HOST);
      console.log('Region:', process.env.AWS_REGION);
    } else {
      console.log('Database: Local SQLite (default)');
    }
    
    await createAndStartFullServer();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

main();