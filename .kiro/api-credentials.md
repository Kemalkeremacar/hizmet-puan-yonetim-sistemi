# HUV API Credentials

## Authentication
- **Base URL:** http://localhost:3000
- **API Prefix:** /api

## Login Endpoint
```
POST /api/auth/login
Content-Type: application/json

{
  "kullaniciAdi": "admin",
  "sifre": "admin123"
}
```

## PowerShell Login Command
```powershell
$body = @{ kullaniciAdi = "admin"; sifre = "admin123" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = $response.data.token
```

## Using Token
```powershell
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3000/api/matching/stats" -Method GET -Headers $headers
```

## Test Matching
```powershell
# Get stats
Invoke-RestMethod -Uri "http://localhost:3000/api/matching/stats" -Method GET -Headers $headers

# Run batch matching (small batch for testing)
$batchBody = @{ batchSize = 10; forceRematch = $false } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/matching/run-batch" -Method POST -Body $batchBody -ContentType "application/json" -Headers $headers
```

## Notes
- Token expires in 24h
- Admin role required for most operations
- Always use Bearer token in Authorization header