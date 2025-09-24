require('dotenv').config();
const { createAndStartFullServer } = require('./dist/api/full-server.js');

async function main() {
  try {
    console.log('Starting Alpaca Herd Management API with RDS...');
    console.log('Database:', process.env.RDS_HOST);
    console.log('Region:', process.env.AWS_REGION);
    
    await createAndStartFullServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
