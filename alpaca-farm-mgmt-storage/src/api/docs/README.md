# Alpaca Herd Management API Documentation

## Overview

The Alpaca Herd Management API is a comprehensive REST API designed to manage alpaca herd data including individual animals, health records, breeding information, and management activities. The API follows OpenAPI 3.0 specification and provides a robust, scalable solution for alpaca farm management.

## Features

- **Alpaca Management**: Complete CRUD operations for alpaca records with lineage tracking
- **Health Records**: Vaccination tracking, medical treatments, and health monitoring
- **Breeding Management**: Breeding records with genetic compatibility checking and inbreeding prevention
- **Activity Tracking**: Management activities with audit trails and performance metrics
- **Data Validation**: Comprehensive input validation and error handling
- **Pagination**: Efficient handling of large datasets with configurable pagination
- **Search & Filtering**: Advanced search capabilities across all entities
- **OpenAPI Compliance**: Full OpenAPI 3.0 specification with interactive documentation

## API Endpoints

### Base URL
- **Development**: `http://localhost:3000/api/v1`
- **Production**: `https://api.alpacaherd.com/v1`

### Authentication
Currently, the API does not require authentication. Future versions will include API key or JWT-based authentication.

### Content Type
All requests and responses use `application/json` content type.

## Core Entities

### 1. Alpacas (`/alpacas`)

Manage individual alpaca records with complete lifecycle tracking.

**Key Features:**
- Individual alpaca profiles with physical characteristics
- Lineage tracking (sire/dam relationships)
- Registration number management
- Fiber quality metrics
- Search and filtering capabilities

**Endpoints:**
- `GET /alpacas` - List all alpacas with pagination and filtering
- `POST /alpacas` - Create a new alpaca record
- `GET /alpacas/{id}` - Get specific alpaca by ID
- `PUT /alpacas/{id}` - Update alpaca information
- `DELETE /alpacas/{id}` - Remove alpaca from herd
- `GET /alpacas/{id}/lineage` - Get family tree information
- `GET /alpacas/{id}/offspring` - Get all offspring for an alpaca
- `GET /alpacas/search` - Advanced search with multiple criteria

### 2. Health Records (`/health-records`)

Track medical history, vaccinations, and health monitoring for each alpaca.

**Key Features:**
- Vaccination scheduling and tracking
- Medical treatment records
- Health observations and checkups
- Overdue vaccination alerts
- Veterinarian tracking

**Endpoints:**
- `GET /health-records` - List all health records
- `POST /health-records` - Create new health record
- `GET /health-records/{id}` - Get specific health record
- `PUT /health-records/{id}` - Update health record
- `DELETE /health-records/{id}` - Remove health record
- `GET /alpacas/{id}/health` - Get health records for specific alpaca
- `GET /health-records/overdue` - Get overdue vaccinations

### 3. Breeding Records (`/breeding-records`)

Manage breeding programs with genetic tracking and compatibility checking.

**Key Features:**
- Breeding record management
- Genetic compatibility checking
- Inbreeding prevention
- Expected birth tracking
- Offspring management

**Endpoints:**
- `GET /breeding-records` - List all breeding records
- `POST /breeding-records` - Create new breeding record
- `GET /breeding-records/{id}` - Get specific breeding record
- `PUT /breeding-records/{id}` - Update breeding record
- `DELETE /breeding-records/{id}` - Remove breeding record
- `POST /breeding-records/check` - Check breeding compatibility
- `GET /alpacas/{id}/breeding` - Get breeding records for specific alpaca

### 4. Management Activities (`/activities`)

Track all management activities and operations performed on the herd.

**Key Features:**
- Activity logging and tracking
- Bulk operations for herd-wide activities
- Performance metrics and reporting
- Audit trail maintenance
- Activity scheduling

**Endpoints:**
- `GET /activities` - List all activities
- `POST /activities` - Create new activity
- `GET /activities/{id}` - Get specific activity
- `PUT /activities/{id}` - Update activity
- `DELETE /activities/{id}` - Remove activity
- `POST /activities/bulk` - Create bulk activity for multiple alpacas
- `GET /alpacas/{id}/activities` - Get activities for specific alpaca

## Request/Response Format

### Successful Response Format
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "pagination": {  // Only for paginated responses
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {  // Optional additional details
      "field": "fieldName",
      "value": "invalidValue",
      "constraint": "validationRule"
    }
  }
}
```

### HTTP Status Codes

- **200 OK**: Successful GET, PUT requests
- **201 Created**: Successful POST requests
- **204 No Content**: Successful DELETE requests
- **400 Bad Request**: Invalid request parameters
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate registration)
- **422 Unprocessable Entity**: Validation errors
- **500 Internal Server Error**: Server errors

## Pagination

All list endpoints support pagination with the following query parameters:

- `page` (integer, default: 1): Page number (1-based)
- `limit` (integer, default: 20, max: 100): Items per page
- `sortBy` (string): Field to sort by
- `sortOrder` (string): Sort order (`asc` or `desc`, default: `asc`)

Example:
```
GET /api/v1/alpacas?page=2&limit=50&sortBy=birthDate&sortOrder=desc
```

## Filtering and Search

### Alpaca Filtering
- `name`: Partial name match
- `gender`: Exact match (`male` or `female`)
- `color`: Partial color match
- `registrationNumber`: Partial registration number match
- `birthDateFrom`/`birthDateTo`: Date range filtering

### Health Record Filtering
- `alpacaId`: Filter by specific alpaca
- `recordType`: Filter by record type
- `dateFrom`/`dateTo`: Date range filtering
- `veterinarian`: Filter by veterinarian name

### Breeding Record Filtering
- `sireId`: Filter by sire (father)
- `damId`: Filter by dam (mother)
- `dateFrom`/`dateTo`: Date range filtering

### Activity Filtering
- `activityType`: Filter by activity type
- `performedBy`: Filter by performer
- `dateFrom`/`dateTo`: Date range filtering
- `alpacaId`: Filter by specific alpaca

## Data Validation

The API implements comprehensive data validation:

### Field Length Limits
- Alpaca name: 1-100 characters
- Registration number: 1-50 characters
- Color: 1-50 characters
- Health description: 1-1000 characters
- Activity description: 1-1000 characters
- Notes fields: 0-2000 characters

### Numeric Limits
- Weight: 0-500 pounds
- Height: 0-100 inches
- Fiber micron count: 10-40 microns
- Fiber staple length: 1-8 inches

### Date Validation
- All dates must be in ISO format (YYYY-MM-DD)
- Birth dates cannot be in the future
- Due dates must be after breeding dates

### Business Rules
- Sire and dam cannot be the same alpaca
- Inbreeding prevention (configurable relationship degree)
- Activity dates cannot be in the future
- Health record due dates must be after record dates

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Requested resource not found |
| `DUPLICATE_REGISTRATION` | Registration number already exists |
| `INVALID_RELATIONSHIP` | Invalid alpaca relationship |
| `INBREEDING_DETECTED` | Breeding would result in inbreeding |
| `DATABASE_ERROR` | Internal database error |

## Examples

### Create an Alpaca
```bash
curl -X POST http://localhost:3000/api/v1/alpacas \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Snowball",
    "birthDate": "2020-03-15",
    "gender": "female",
    "color": "white",
    "registrationNumber": "REG001",
    "weight": 145.5,
    "height": 35.0,
    "fiberQuality": {
      "micronCount": 18.5,
      "stapleLength": 4.2,
      "crimp": "fine",
      "density": "medium"
    }
  }'
```

### Get Alpaca Lineage
```bash
curl http://localhost:3000/api/v1/alpacas/123e4567-e89b-12d3-a456-426614174000/lineage?generations=3
```

### Create Health Record
```bash
curl -X POST http://localhost:3000/api/v1/health-records \
  -H "Content-Type: application/json" \
  -d '{
    "alpacaId": "123e4567-e89b-12d3-a456-426614174000",
    "recordType": "vaccination",
    "date": "2023-06-01",
    "description": "Annual CDT vaccination",
    "veterinarian": "Dr. Smith",
    "nextDueDate": "2024-06-01"
  }'
```

### Check Breeding Compatibility
```bash
curl -X POST http://localhost:3000/api/v1/breeding-records/check \
  -H "Content-Type: application/json" \
  -d '{
    "sireId": "123e4567-e89b-12d3-a456-426614174001",
    "damId": "123e4567-e89b-12d3-a456-426614174002"
  }'
```

### Create Bulk Activity
```bash
curl -X POST http://localhost:3000/api/v1/activities/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "activityType": "shearing",
    "date": "2023-06-01",
    "alpacaIds": [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002",
      "123e4567-e89b-12d3-a456-426614174003"
    ],
    "performedBy": "Shearing Team",
    "description": "Annual herd shearing"
  }'
```

## Interactive Documentation

The API provides interactive documentation using Swagger UI:

- **Development**: http://localhost:3000/api-docs
- **Production**: https://api.alpacaherd.com/api-docs

The interactive documentation allows you to:
- Explore all available endpoints
- View request/response schemas
- Test API calls directly from the browser
- Download the OpenAPI specification

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Default**: 100 requests per 15-minute window per IP address
- **Headers**: Rate limit information is included in response headers
- **Exceeded**: Returns HTTP 429 with retry information

## Performance Considerations

- **Pagination**: Use appropriate page sizes (default: 20, max: 100)
- **Filtering**: Use specific filters to reduce response sizes
- **Caching**: Responses include appropriate cache headers
- **Timeouts**: Requests timeout after 30 seconds
- **Compression**: Responses are compressed when supported

## Versioning

The API uses URL-based versioning:
- Current version: `v1`
- Base path: `/api/v1`
- Version header: `X-API-Version: 1.0.0`

## Support and Contact

For API support, documentation issues, or feature requests:
- Email: support@alpacaherd.com
- Documentation: This README and interactive API docs
- Issues: Report via your preferred issue tracking system

## Changelog

### Version 1.0.0
- Initial API release
- Complete CRUD operations for all entities
- OpenAPI 3.0 specification
- Comprehensive validation and error handling
- Interactive documentation
- Rate limiting and security features