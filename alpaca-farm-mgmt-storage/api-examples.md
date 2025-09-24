# API Examples and Usage Guide

This document provides comprehensive examples for using the Alpaca Farm Management Storage API. All examples use curl commands and can be adapted for any HTTP client.

## Base URL Configuration

### Local Development
```bash
export API_URL="http://localhost:3000/api/v1"
```

### Deployed API
```bash
export API_URL="https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/Prod/api/v1"
```

## Authentication

Currently, the API does not require authentication. In production, you may want to add API keys or other authentication mechanisms.

## Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { /* error details */ }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Alpaca Management

### List All Alpacas

**Basic listing:**
```bash
curl -X GET "$API_URL/alpacas" \
  -H "Content-Type: application/json"
```

**With pagination:**
```bash
curl -X GET "$API_URL/alpacas?page=1&limit=10" \
  -H "Content-Type: application/json"
```

**With sorting:**
```bash
curl -X GET "$API_URL/alpacas?sortBy=name&sortOrder=asc" \
  -H "Content-Type: application/json"
```

**With filters:**
```bash
# Filter by gender and color
curl -X GET "$API_URL/alpacas?gender=female&color=white" \
  -H "Content-Type: application/json"

# Filter by birth date range
curl -X GET "$API_URL/alpacas?birthDateFrom=2020-01-01&birthDateTo=2023-12-31" \
  -H "Content-Type: application/json"

# Filter by registration number
curl -X GET "$API_URL/alpacas?registrationNumber=ARI123456" \
  -H "Content-Type: application/json"
```

### Search Alpacas

**Text search:**
```bash
curl -X GET "$API_URL/alpacas/search?q=bella" \
  -H "Content-Type: application/json"
```

**Advanced search with filters:**
```bash
curl -X GET "$API_URL/alpacas/search?q=white&gender=female&page=1&limit=5" \
  -H "Content-Type: application/json"
```

### Get Specific Alpaca

```bash
# Replace {alpaca_id} with actual alpaca ID
curl -X GET "$API_URL/alpacas/{alpaca_id}" \
  -H "Content-Type: application/json"
```

### Create New Alpaca

**Basic alpaca creation:**
```bash
curl -X POST "$API_URL/alpacas" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Luna",
    "registrationNumber": "ARI789012",
    "gender": "female",
    "birthDate": "2021-03-15",
    "color": "white",
    "fiberQuality": "fine",
    "weight": 65.5,
    "height": 95.2
  }'
```

**With lineage information:**
```bash
curl -X POST "$API_URL/alpacas" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Star",
    "registrationNumber": "ARI345678",
    "gender": "male",
    "birthDate": "2022-06-10",
    "color": "brown",
    "fiberQuality": "superfine",
    "sireId": "existing-sire-id",
    "damId": "existing-dam-id",
    "weight": 70.0,
    "height": 98.5,
    "notes": "Excellent fiber quality, show potential"
  }'
```

### Update Alpaca

**Partial update:**
```bash
curl -X PUT "$API_URL/alpacas/{alpaca_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "weight": 68.2,
    "notes": "Updated weight after recent weighing"
  }'
```

**Full update:**
```bash
curl -X PUT "$API_URL/alpacas/{alpaca_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Luna Star",
    "color": "light_brown",
    "weight": 70.0,
    "height": 96.0,
    "fiberQuality": "superfine",
    "notes": "Color changed with age, excellent development"
  }'
```

### Delete Alpaca

```bash
curl -X DELETE "$API_URL/alpacas/{alpaca_id}" \
  -H "Content-Type: application/json"
```

### Get Alpaca Lineage

```bash
# Get 3 generations (default)
curl -X GET "$API_URL/alpacas/{alpaca_id}/lineage" \
  -H "Content-Type: application/json"

# Get specific number of generations
curl -X GET "$API_URL/alpacas/{alpaca_id}/lineage?generations=5" \
  -H "Content-Type: application/json"
```

### Get Alpaca Offspring

```bash
curl -X GET "$API_URL/alpacas/{alpaca_id}/offspring" \
  -H "Content-Type: application/json"
```

## Health Records Management

### List Health Records

**All health records:**
```bash
curl -X GET "$API_URL/health-records" \
  -H "Content-Type: application/json"
```

**With filters:**
```bash
# Filter by alpaca
curl -X GET "$API_URL/health-records?alpacaId={alpaca_id}" \
  -H "Content-Type: application/json"

# Filter by record type
curl -X GET "$API_URL/health-records?recordType=vaccination" \
  -H "Content-Type: application/json"

# Filter by date range
curl -X GET "$API_URL/health-records?dateFrom=2024-01-01&dateTo=2024-12-31" \
  -H "Content-Type: application/json"

# Filter by veterinarian
curl -X GET "$API_URL/health-records?veterinarian=Dr.%20Smith" \
  -H "Content-Type: application/json"
```

### Get Health Records for Specific Alpaca

```bash
# All health records for an alpaca
curl -X GET "$API_URL/alpacas/{alpaca_id}/health" \
  -H "Content-Type: application/json"

# Filter by record type
curl -X GET "$API_URL/alpacas/{alpaca_id}/health?recordType=treatment" \
  -H "Content-Type: application/json"

# Filter by date range
curl -X GET "$API_URL/alpacas/{alpaca_id}/health?dateFrom=2024-01-01&dateTo=2024-06-30" \
  -H "Content-Type: application/json"
```

### Create Health Record

**Vaccination record:**
```bash
curl -X POST "$API_URL/health-records" \
  -H "Content-Type: application/json" \
  -d '{
    "alpacaId": "{alpaca_id}",
    "recordType": "vaccination",
    "date": "2024-01-15",
    "description": "Annual CDT vaccination",
    "veterinarian": "Dr. Sarah Johnson",
    "medication": "CDT vaccine",
    "dosage": "2ml subcutaneous",
    "nextDueDate": "2025-01-15",
    "notes": "No adverse reactions observed"
  }'
```

**Treatment record:**
```bash
curl -X POST "$API_URL/health-records" \
  -H "Content-Type: application/json" \
  -d '{
    "alpacaId": "{alpaca_id}",
    "recordType": "treatment",
    "date": "2024-02-10",
    "description": "Antibiotic treatment for respiratory infection",
    "veterinarian": "Dr. Mike Wilson",
    "medication": "Penicillin",
    "dosage": "5ml intramuscular daily for 5 days",
    "cost": 45.50,
    "notes": "Complete recovery after treatment course"
  }'
```

**Checkup record:**
```bash
curl -X POST "$API_URL/health-records" \
  -H "Content-Type: application/json" \
  -d '{
    "alpacaId": "{alpaca_id}",
    "recordType": "checkup",
    "date": "2024-03-20",
    "description": "Routine health examination",
    "veterinarian": "Dr. Sarah Johnson",
    "weight": 68.5,
    "temperature": 38.2,
    "heartRate": 70,
    "notes": "Excellent overall health, slight weight gain noted"
  }'
```

### Update Health Record

```bash
curl -X PUT "$API_URL/health-records/{record_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Updated: Follow-up examination scheduled for next month",
    "cost": 55.00
  }'
```

### Get Overdue Vaccinations

```bash
curl -X GET "$API_URL/health-records/overdue" \
  -H "Content-Type: application/json"
```

### Delete Health Record

```bash
curl -X DELETE "$API_URL/health-records/{record_id}" \
  -H "Content-Type: application/json"
```

## Breeding Records Management

### List Breeding Records

**All breeding records:**
```bash
curl -X GET "$API_URL/breeding-records" \
  -H "Content-Type: application/json"
```

**With filters:**
```bash
# Filter by sire
curl -X GET "$API_URL/breeding-records?sireId={sire_id}" \
  -H "Content-Type: application/json"

# Filter by dam
curl -X GET "$API_URL/breeding-records?damId={dam_id}" \
  -H "Content-Type: application/json"

# Filter by date range
curl -X GET "$API_URL/breeding-records?dateFrom=2024-01-01&dateTo=2024-12-31" \
  -H "Content-Type: application/json"
```

### Get Breeding Records for Specific Alpaca

```bash
# All breeding records (as sire or dam)
curl -X GET "$API_URL/alpacas/{alpaca_id}/breeding" \
  -H "Content-Type: application/json"

# Only as sire
curl -X GET "$API_URL/alpacas/{alpaca_id}/breeding?role=sire" \
  -H "Content-Type: application/json"

# Only as dam
curl -X GET "$API_URL/alpacas/{alpaca_id}/breeding?role=dam" \
  -H "Content-Type: application/json"
```

### Check Breeding Compatibility

```bash
curl -X POST "$API_URL/breeding-records/check" \
  -H "Content-Type: application/json" \
  -d '{
    "sireId": "{sire_id}",
    "damId": "{dam_id}"
  }'
```

### Create Breeding Record

**Planned breeding:**
```bash
curl -X POST "$API_URL/breeding-records" \
  -H "Content-Type: application/json" \
  -d '{
    "sireId": "{sire_id}",
    "damId": "{dam_id}",
    "breedingDate": "2024-01-15",
    "breedingMethod": "natural",
    "expectedDueDate": "2024-12-15",
    "notes": "First breeding for this dam, excellent genetic match"
  }'
```

**Completed breeding with offspring:**
```bash
curl -X POST "$API_URL/breeding-records" \
  -H "Content-Type: application/json" \
  -d '{
    "sireId": "{sire_id}",
    "damId": "{dam_id}",
    "breedingDate": "2023-01-15",
    "breedingMethod": "natural",
    "expectedDueDate": "2023-12-15",
    "actualBirthDate": "2023-12-10",
    "offspringId": "{offspring_id}",
    "successful": true,
    "notes": "Healthy cria born, no complications"
  }'
```

### Update Breeding Record

```bash
curl -X PUT "$API_URL/breeding-records/{record_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "actualBirthDate": "2024-12-08",
    "offspringId": "{offspring_id}",
    "successful": true,
    "notes": "Early delivery, healthy male cria"
  }'
```

### Delete Breeding Record

```bash
curl -X DELETE "$API_URL/breeding-records/{record_id}" \
  -H "Content-Type: application/json"
```

## Management Activities

### List Activities

**All activities:**
```bash
curl -X GET "$API_URL/activities" \
  -H "Content-Type: application/json"
```

**With filters:**
```bash
# Filter by activity type
curl -X GET "$API_URL/activities?activityType=feeding" \
  -H "Content-Type: application/json"

# Filter by date range
curl -X GET "$API_URL/activities?dateFrom=2024-01-01&dateTo=2024-01-31" \
  -H "Content-Type: application/json"

# Filter by performer
curl -X GET "$API_URL/activities?performedBy=John%20Doe" \
  -H "Content-Type: application/json"

# Filter by alpaca
curl -X GET "$API_URL/activities?alpacaId={alpaca_id}" \
  -H "Content-Type: application/json"
```

### Get Activities for Specific Alpaca

```bash
# All activities for an alpaca
curl -X GET "$API_URL/alpacas/{alpaca_id}/activities" \
  -H "Content-Type: application/json"

# Filter by activity type
curl -X GET "$API_URL/alpacas/{alpaca_id}/activities?activityType=shearing" \
  -H "Content-Type: application/json"
```

### Create Activity

**Feeding activity:**
```bash
curl -X POST "$API_URL/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "activityType": "feeding",
    "date": "2024-01-15",
    "description": "Morning hay feeding",
    "performedBy": "Farm Staff",
    "duration": 30,
    "notes": "All animals ate well, no issues observed",
    "alpacaIds": ["{alpaca_id_1}", "{alpaca_id_2}", "{alpaca_id_3}"]
  }'
```

**Shearing activity:**
```bash
curl -X POST "$API_URL/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "activityType": "shearing",
    "date": "2024-05-15",
    "description": "Annual shearing",
    "performedBy": "Professional Shearer",
    "duration": 45,
    "fiberWeight": 3.2,
    "fiberQuality": "fine",
    "notes": "Excellent fiber quality, no cuts or injuries",
    "alpacaIds": ["{alpaca_id}"]
  }'
```

**Weighing activity:**
```bash
curl -X POST "$API_URL/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "activityType": "weighing",
    "date": "2024-03-10",
    "description": "Monthly weight check",
    "performedBy": "Veterinarian",
    "duration": 15,
    "weight": 68.5,
    "notes": "Healthy weight gain since last measurement",
    "alpacaIds": ["{alpaca_id}"]
  }'
```

**Training activity:**
```bash
curl -X POST "$API_URL/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "activityType": "training",
    "date": "2024-02-20",
    "description": "Halter training session",
    "performedBy": "Trainer",
    "duration": 60,
    "notes": "Good progress, alpaca is becoming more comfortable with halter",
    "alpacaIds": ["{alpaca_id}"]
  }'
```

### Update Activity

```bash
curl -X PUT "$API_URL/activities/{activity_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Updated: Activity completed successfully with no issues",
    "duration": 35
  }'
```

### Delete Activity

```bash
curl -X DELETE "$API_URL/activities/{activity_id}" \
  -H "Content-Type: application/json"
```

## Batch Operations

### Create Multiple Records

**Multiple health records:**
```bash
curl -X POST "$API_URL/health-records/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "alpacaId": "{alpaca_id_1}",
        "recordType": "vaccination",
        "date": "2024-01-15",
        "description": "CDT vaccination",
        "veterinarian": "Dr. Smith"
      },
      {
        "alpacaId": "{alpaca_id_2}",
        "recordType": "vaccination",
        "date": "2024-01-15",
        "description": "CDT vaccination",
        "veterinarian": "Dr. Smith"
      }
    ]
  }'
```

## Error Handling Examples

### Validation Errors

**Invalid data format:**
```bash
# This will return a 422 validation error
curl -X POST "$API_URL/alpacas" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "gender": "invalid_gender",
    "birthDate": "invalid_date"
  }'
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "name": "Name is required",
      "gender": "Gender must be 'male' or 'female'",
      "birthDate": "Invalid date format"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Not Found Errors

```bash
# This will return a 404 error
curl -X GET "$API_URL/alpacas/non-existent-id" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Alpaca not found"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Testing Scripts

### Automated Testing

Use the provided testing script:
```bash
# Test all endpoints
./scripts/api-examples.sh --verbose

# Test specific category
./scripts/api-examples.sh alpacas --verbose

# Test against deployed API
API_URL="https://your-api-gateway-url/api/v1" ./scripts/api-examples.sh
```

### Health Check

```bash
# Basic health check
curl -X GET "$API_URL/health" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0",
    "database": "connected"
  }
}
```

## Rate Limiting and Performance

### Pagination Best Practices

```bash
# Use appropriate page sizes
curl -X GET "$API_URL/alpacas?page=1&limit=20" \
  -H "Content-Type: application/json"

# For large datasets, use smaller pages
curl -X GET "$API_URL/health-records?page=1&limit=50" \
  -H "Content-Type: application/json"
```

### Filtering for Performance

```bash
# Use specific filters to reduce response size
curl -X GET "$API_URL/alpacas?gender=female&birthDateFrom=2020-01-01" \
  -H "Content-Type: application/json"

# Use date ranges for time-based queries
curl -X GET "$API_URL/activities?dateFrom=2024-01-01&dateTo=2024-01-31" \
  -H "Content-Type: application/json"
```

## Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const apiClient = axios.create({
  baseURL: process.env.API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Get all alpacas
const getAlpacas = async () => {
  try {
    const response = await apiClient.get('/alpacas');
    return response.data;
  } catch (error) {
    console.error('Error fetching alpacas:', error.response?.data || error.message);
    throw error;
  }
};

// Create new alpaca
const createAlpaca = async (alpacaData) => {
  try {
    const response = await apiClient.post('/alpacas', alpacaData);
    return response.data;
  } catch (error) {
    console.error('Error creating alpaca:', error.response?.data || error.message);
    throw error;
  }
};
```

### Python

```python
import requests
import os

class AlpacaFarmAPI:
    def __init__(self, base_url=None):
        self.base_url = base_url or os.getenv('API_URL', 'http://localhost:3000/api/v1')
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def get_alpacas(self, **params):
        response = self.session.get(f'{self.base_url}/alpacas', params=params)
        response.raise_for_status()
        return response.json()
    
    def create_alpaca(self, alpaca_data):
        response = self.session.post(f'{self.base_url}/alpacas', json=alpaca_data)
        response.raise_for_status()
        return response.json()

# Usage
api = AlpacaFarmAPI()
alpacas = api.get_alpacas(gender='female', limit=10)
```

This comprehensive guide covers all the major API endpoints and usage patterns. Use these examples as a starting point for integrating with the Alpaca Farm Management Storage API.