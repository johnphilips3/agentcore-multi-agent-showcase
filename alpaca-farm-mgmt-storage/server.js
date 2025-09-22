require('dotenv').config();
const { createAndStartServer } = require('./dist/api/server.js');

async function main() {
  try {
    console.log('Starting Alpaca Herd Management API with RDS...');
    console.log('Database:', process.env.RDS_HOST);
    console.log('Region:', process.env.AWS_REGION);
    
    await createAndStartServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
