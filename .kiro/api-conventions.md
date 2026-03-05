---
title: API Conventions and Standards
description: Backend API standards, response formats, error handling, and naming conventions
inclusion: auto
fileMatchPattern: "**/controllers/**,**/routes/**,**/middleware/**"
---

# API Conventions and Standards

This document defines the backend API standards, conventions, and best practices used throughout the HUV Management System.

## Base URL

```
Development: http://localhost:3000/api
Production: TBD
```

## Response Format

### Success Response

All successful API responses follow this structure:

```javascript
{
  "success": true,
  "message": "Success message",
  "data": { /* response data */ }
}
```

**Example**:
```javascript
{
  "success": true,
  "message": "SUT kodları listelendi",
  "data": [
    {
      "sutId": 1,
      "sutKodu": "10.01.0001",
      "islemAdi": "Poliklinik Muayenesi"
    }
  ]
}
```

### Paginated Response

For paginated endpoints:

```javascript
{
  "success": true,
  "message": "Success message",
  "data": [ /* array of records */ ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 7129,
    "totalPages": 143
  }
}
```

**Example**:
```javascript
{
  "success": true,
  "message": "Eşleşme sonuçları listelendi",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 7129,
    "totalPages": 143
  }
}
```

### Error Response

All error responses follow this structure:

```javascript
{
  "success": false,
  "message": "Error message",
  "errors": null | { /* validation errors */ }
}
```

**Example**:
```javascript
{
  "success": false,
  "message": "SUT kodu bulunamadı",
  "errors": null
}
```

**Validation Error Example**:
```javascript
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "sutKodu": "SUT kodu gereklidir",
    "altTeminatId": "Alt teminat ID gereklidir"
  }
}
```

---

## HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH requests |
| 201 | Created | Successful POST request (resource created) |
| 400 | Bad Request | Invalid request parameters or validation error |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | User doesn't have permission |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error (database, unexpected errors) |

---

## Response Helper Functions

Located in `huv-api/src/utils/response.js`:

### success()

```javascript
success(res, data, message = 'Success', statusCode = 200)
```

**Usage**:
```javascript
return success(res, result.recordset, 'SUT kodları listelendi');
```

### error()

```javascript
error(res, message = 'Error', statusCode = 500, errors = null)
```

**Usage**:
```javascript
return error(res, 'SUT kodu bulunamadı', 404);
```

### paginated()

```javascript
paginated(res, data, page, limit, total, message = 'Success')
```

**Usage**:
```javascript
return paginated(res, result.recordset, page, limit, total, 'Kayıtlar listelendi');
```

---

## Naming Conventions

### Endpoint Naming

- Use kebab-case for URLs
- Use plural nouns for collections
- Use singular nouns for single resources

**Examples**:
```
GET    /api/sut                    # List all SUT codes
GET    /api/sut/:kod               # Get single SUT code
GET    /api/sut/ana-basliklar      # List SUT ana başlıklar
POST   /api/matching/run-batch     # Run batch matching
GET    /api/matching/results       # Get matching results
```

### Query Parameters

- Use camelCase for query parameters
- Use descriptive names

**Examples**:
```
?page=1
?limit=50
?anaBaslikNo=1
?confidenceMin=70
?confidenceMax=100
?search=muayene
?sort=SutKodu
?order=ASC
```

### Request Body

- Use camelCase for JSON keys
- Match database column names when possible

**Example**:
```javascript
{
  "sutId": 123,
  "altTeminatId": 456,
  "userId": 1,
  "batchSize": 100,
  "forceRematch": false
}
```

### Response Data

- Use camelCase for JSON keys
- Convert database column names from PascalCase to camelCase

**Database Column** → **API Response**:
```
SutID → sutId
SutKodu → sutKodu
IslemAdi → islemAdi
AltTeminatID → altTeminatId
ConfidenceScore → confidenceScore
```

**Example**:
```javascript
// Database: SutID, SutKodu, IslemAdi
// API Response:
{
  "sutId": 123,
  "sutKodu": "10.01.0001",
  "islemAdi": "Poliklinik Muayenesi"
}
```

---

## Error Handling

### Global Error Handler

Located in `huv-api/src/middleware/errorHandler.js`:

```javascript
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // SQL Server errors
  if (err.name === 'RequestError' || err.number) {
    // Handle SQL errors
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return error(res, 'Validation error', 400, err.errors);
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Invalid token', 401);
  }
  
  // Default error
  return error(res, err.message || 'Internal server error', err.statusCode || 500);
};
```

### SQL Server Error Handling

```javascript
// Invalid object name (table doesn't exist)
if (err.number === 208) {
  return error(res, `Tablo bulunamadı: ${err.message}`, 500);
}

// Constraint violation
if (err.number === 2627) {
  return error(res, 'Duplicate key error', 400);
}

// Foreign key violation
if (err.number === 547) {
  return error(res, 'Foreign key constraint violation', 400);
}
```

### Try-Catch Pattern

All controller functions use try-catch with next():

```javascript
const getAnaBasliklar = async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`...`);
    return success(res, result.recordset, 'Ana başlıklar listelendi');
  } catch (err) {
    next(err); // Pass to global error handler
  }
};
```

---

## Authentication & Authorization

### JWT Token

- Token stored in `Authorization` header
- Format: `Bearer <token>`
- Expiration: 24 hours

**Middleware**: `huv-api/src/middleware/auth.js`

```javascript
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return error(res, 'Authentication required', 401);
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return error(res, 'Invalid token', 401);
  }
};
```

### Protected Routes

```javascript
// Apply auth middleware to protected routes
router.get('/api/matching/results', auth, matchingController.getResults);
router.post('/api/matching/run-batch', auth, matchingController.runBatch);
```

### User Roles

- `admin`: Full access (import, matching, approval)
- `user`: Read-only access

**Role Check**:
```javascript
if (req.user.role !== 'admin') {
  return error(res, 'Admin access required', 403);
}
```

---

## Pagination

### Standard Pagination

All list endpoints support pagination:

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 50, max: 100)

**Implementation**:
```javascript
const { page = 1, limit = 50 } = req.query;
const offset = (page - 1) * limit;

// Count query
const countResult = await pool.request().query(`
  SELECT COUNT(*) as total FROM ...
`);
const total = countResult.recordset[0].total;

// Data query with OFFSET/FETCH
const dataResult = await pool.request()
  .input('offset', sql.Int, offset)
  .input('limit', sql.Int, parseInt(limit))
  .query(`
    SELECT * FROM ...
    ORDER BY ...
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

return paginated(res, dataResult.recordset, page, limit, total);
```

---

## Filtering & Searching

### Query Parameter Filters

Use descriptive query parameters for filtering:

```javascript
const {
  anaBaslikNo,
  kategoriId,
  search,
  confidenceMin,
  confidenceMax,
  sutKodu,
  islemAdi
} = req.query;
```

### Dynamic WHERE Clause

Build WHERE clause dynamically:

```javascript
let whereClause = 'WHERE 1=1';
const params = {};

if (sutKodu) {
  whereClause += ` AND s.SutKodu LIKE @sutKodu`;
  params.sutKodu = `%${sutKodu}%`;
}

if (islemAdi) {
  whereClause += ` AND s.IslemAdi LIKE @islemAdi`;
  params.islemAdi = `%${islemAdi}%`;
}

if (confidenceMin) {
  whereClause += ` AND a.ConfidenceScore >= @confidenceMin`;
  params.confidenceMin = parseFloat(confidenceMin);
}
```

### SQL Parameter Binding

Always use parameterized queries to prevent SQL injection:

```javascript
const request = pool.request();
Object.keys(params).forEach(key => {
  request.input(key, params[key]);
});

const result = await request.query(`
  SELECT * FROM ... ${whereClause}
`);
```

---

## Sorting

### Query Parameters

- `sort`: Column name (default: varies by endpoint)
- `order`: ASC or DESC (default: ASC)

**Example**:
```
?sort=SutKodu&order=DESC
```

### Implementation

```javascript
const { sort = 'SutKodu', order = 'ASC' } = req.query;

// Whitelist allowed columns
const validSortColumns = ['SutKodu', 'IslemAdi', 'Puan', 'KategoriAdi'];
const sortColumn = validSortColumns.includes(sort) ? sort : 'SutKodu';
const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

// Special sorting for SutKodu (handles alphanumeric codes)
if (sortColumn === 'SutKodu') {
  query += ` ORDER BY 
    CASE 
      WHEN ${sortColumn} LIKE '[0-9]%' THEN 0
      ELSE 1
    END,
    ${sortColumn} ${sortOrder}`;
} else {
  query += ` ORDER BY ${sortColumn} ${sortOrder}`;
}
```

---

## Database Connection

### Connection Pool

Located in `huv-api/src/config/database.js`:

```javascript
const config = {
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME || 'HuvDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};
```

### Usage Pattern

```javascript
const { getPool, sql } = require('../config/database');

const pool = await getPool();
const result = await pool.request()
  .input('param1', sql.Int, value1)
  .input('param2', sql.NVarChar, value2)
  .query(`SELECT ...`);
```

### SQL Data Types

```javascript
sql.Int           // Integer
sql.BigInt        // Big integer
sql.NVarChar      // Unicode string (default)
sql.VarChar       // ASCII string
sql.Decimal(p, s) // Decimal (precision, scale)
sql.Bit           // Boolean (0/1)
sql.DateTime      // DateTime
sql.Date          // Date only
```

---

## Validation

### Input Validation

Validate all user inputs:

```javascript
// Required fields
if (!sutId) {
  return error(res, 'SUT ID gereklidir', 400);
}

// Numeric validation
if (isNaN(sutId) || sutId < 1) {
  return error(res, 'Geçersiz SUT ID', 400);
}

// Range validation
if (batchSize && (batchSize < 1 || batchSize > 10000)) {
  return error(res, 'Batch size must be between 1 and 10000', 400);
}

// String validation
if (search && search.length < 2) {
  return error(res, 'Arama terimi en az 2 karakter olmalıdır', 400);
}
```

### Database Validation

Check if records exist before operations:

```javascript
const result = await pool.request()
  .input('sutId', sql.Int, sutId)
  .query(`SELECT * FROM SutIslemler WHERE SutID = @sutId`);

if (result.recordset.length === 0) {
  return error(res, 'SUT işlem bulunamadı', 404);
}
```

---

## Logging

### Console Logging

Use descriptive emoji prefixes:

```javascript
console.log('✅ Success:', message);
console.error('❌ Error:', error);
console.warn('⚠️  Warning:', warning);
console.info('ℹ️  Info:', info);
console.log('🔍 Debug:', debug);
```

### SQL Error Logging

```javascript
console.error('❌ SQL Server Error:', {
  message: err.message,
  number: err.number,
  state: err.state,
  class: err.class,
  serverName: err.serverName,
  procName: err.procName,
  lineNumber: err.lineNumber
});
```

### Matching Engine Logging

```javascript
console.log(`⚠️  Skipping SutID ${sutId} - manually overridden`);
console.log(`✅ Matched ${matchedCount} records`);
console.log(`❌ Failed to match ${unmatchedCount} records`);
```

---

## File Upload

### Middleware

Located in `huv-api/src/middleware/uploadMiddleware.js`:

```javascript
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});
```

### Usage

```javascript
router.post('/api/import/sut', 
  auth, 
  upload.single('file'), 
  importController.importSutList
);
```

---

## Import Lock Mechanism

### Middleware

Located in `huv-api/src/middleware/importLock.js`:

Prevents concurrent imports:

```javascript
let isImportInProgress = false;

const importLock = (req, res, next) => {
  if (isImportInProgress) {
    return error(res, 'Başka bir import işlemi devam ediyor', 409);
  }
  
  isImportInProgress = true;
  
  // Release lock after response
  res.on('finish', () => {
    isImportInProgress = false;
  });
  
  next();
};
```

### Usage

```javascript
router.post('/api/import/sut', 
  auth, 
  importLock, 
  upload.single('file'), 
  importController.importSutList
);
```

---

## CORS Configuration

Located in `huv-api/src/app.js`:

```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

---

## Environment Variables

Located in `huv-api/.env`:

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=HuvDB
DB_USER=
DB_PASSWORD=

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Frontend
FRONTEND_URL=http://localhost:5173
```

---

## API Endpoints Summary

### Authentication
```
POST   /api/auth/login          # User login
POST   /api/auth/logout         # User logout
GET    /api/auth/me             # Get current user
```

### SUT Management
```
GET    /api/sut                 # List SUT codes (paginated)
GET    /api/sut/:kod            # Get SUT code details
GET    /api/sut/ara             # Search SUT codes
GET    /api/sut/ana-basliklar   # List SUT ana başlıklar
GET    /api/sut/ana-baslik/:no  # Get ana başlık details
GET    /api/sut/kategoriler     # List categories
GET    /api/sut/kategori/:id    # Get category SUT codes
GET    /api/sut/hiyerarsi       # Get hierarchy tree
GET    /api/sut/unmatched       # Get unmatched records
GET    /api/sut/stats           # Get SUT statistics
```

### HUV Management
```
GET    /api/huv/ana-dallar      # List HUV ana dallar
GET    /api/huv/ana-dal/:kod    # Get ana dal details
GET    /api/huv/alt-teminatlar  # List alt teminatlar
GET    /api/huv/alt-teminat/:id # Get alt teminat details
```

### Matching
```
POST   /api/matching/run-batch  # Run batch matching
GET    /api/matching/results    # Get matching results (paginated)
GET    /api/matching/stats      # Get matching statistics
GET    /api/matching/huv-options/:sutId # Get HUV options for SUT
POST   /api/matching/approve/:sutId     # Approve match
PUT    /api/matching/change/:sutId      # Change match
```

### Import
```
POST   /api/import/sut          # Import SUT list
POST   /api/import/huv          # Import HUV list
POST   /api/import/il-katsayi   # Import il katsayı
```

---

## Best Practices

### 1. Always Use Parameterized Queries
```javascript
// ❌ BAD - SQL Injection risk
const query = `SELECT * FROM SutIslemler WHERE SutKodu = '${sutKodu}'`;

// ✅ GOOD - Safe
const result = await pool.request()
  .input('sutKodu', sql.NVarChar, sutKodu)
  .query(`SELECT * FROM SutIslemler WHERE SutKodu = @sutKodu`);
```

### 2. Always Use Try-Catch
```javascript
// ✅ GOOD
const getAnaBasliklar = async (req, res, next) => {
  try {
    // ... logic
  } catch (err) {
    next(err);
  }
};
```

### 3. Validate All Inputs
```javascript
// ✅ GOOD
if (!sutId || isNaN(sutId)) {
  return error(res, 'Geçersiz SUT ID', 400);
}
```

### 4. Use Response Helpers
```javascript
// ✅ GOOD
return success(res, data, 'İşlem başarılı');
return error(res, 'Hata oluştu', 500);
return paginated(res, data, page, limit, total);
```

### 5. Close Database Connections
```javascript
// Connection pool handles this automatically
// No need to manually close connections
```

### 6. Log Errors Properly
```javascript
// ✅ GOOD
console.error('❌ Error in getAnaBasliklar:', err);
```

### 7. Return Early
```javascript
// ✅ GOOD
if (!sutId) {
  return error(res, 'SUT ID gereklidir', 400);
}

// Continue with logic...
```

---

## Related Files

- `huv-api/src/utils/response.js` - Response helper functions
- `huv-api/src/middleware/errorHandler.js` - Global error handler
- `huv-api/src/middleware/auth.js` - Authentication middleware
- `huv-api/src/middleware/uploadMiddleware.js` - File upload middleware
- `huv-api/src/middleware/importLock.js` - Import lock mechanism
- `huv-api/src/config/database.js` - Database configuration
- `huv-api/src/controllers/` - All API controllers
- `huv-api/src/routes/` - All API routes
