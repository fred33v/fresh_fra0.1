# Frontend-Backend Integration Guide

**Date**: December 21, 2025
**Status**: ✅ Core Integration Complete - Ready for Testing

---

## Overview

Successfully integrated the React Native frontend with the Node.js backend API, replacing client-side AsyncStorage with proper server-side authentication and data persistence.

---

## What Was Implemented

### 1. API Configuration (`constants/api.ts`) ✅

Central configuration for all backend endpoints:

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://localhost:3000', // Dev mode
  ENDPOINTS: {
    AUTH: { SIGNUP, LOGIN, LOGOUT, REFRESH, ME },
    ASSESSMENTS: { CREATE, GET, UPDATE, SUBMIT, RISK_REGISTER },
    KEYPASSES: { VALIDATE, USE, ALLOCATE, STATS },
    PACKAGES: { LIST, RECOMMENDED },
    PURCHASES: { CREATE, CONFIRM, GET },
  },
  TIMEOUT: 30000,
};
```

**Features**:
- Environment-aware URL (localhost for dev, production for release)
- Centralized endpoint definitions
- Type-safe endpoint functions
- Configurable timeout

### 2. API Service Layer (`services/api.service.ts`) ✅

Low-level HTTP client with comprehensive features:

**Key Features**:
- ✅ **JWT Token Management**: Automatic token storage and injection
- ✅ **Token Refresh**: Auto-refresh expired access tokens
- ✅ **Request Timeout**: 30-second default with abort controller
- ✅ **Error Handling**: Structured error responses
- ✅ **Type Safety**: Generic TypeScript types for responses
- ✅ **AsyncStorage Integration**: Persistent token storage

**Methods**:
```typescript
apiService.get<T>(endpoint, options)
apiService.post<T>(endpoint, data, options)
apiService.patch<T>(endpoint, data, options)
apiService.delete<T>(endpoint, options)
apiService.setTokens(accessToken, refreshToken)
apiService.clearTokens()
apiService.isAuthenticated()
```

**Auto-Retry Logic**:
- Detects 401 Unauthorized
- Attempts token refresh with refresh token
- Retries original request with new access token
- Clears tokens if refresh fails

### 3. Authentication Service (`services/auth.service.ts`) ✅

High-level authentication business logic:

**Features**:
- ✅ **User Signup**: Create new employer accounts
- ✅ **User Login**: Email/password authentication
- ✅ **Logout**: Clear tokens and session data
- ✅ **Session Restoration**: Auto-login from cached tokens
- ✅ **Current User**: Fetch updated user data from API
- ✅ **Token Management**: Seamless JWT handling

**Methods**:
```typescript
authService.signup({ email, password, name, organisationName })
authService.login({ email, password })
authService.logout()
authService.getCurrentUser()
authService.restoreSession()
authService.getCachedUser()
authService.getCachedOrganisation()
```

### 4. Updated AuthContext (`contexts/AuthContext.tsx`) ✅

**Changes Made**:
- ✅ Replaced mock signup/login with real API calls
- ✅ JWT token-based authentication
- ✅ Automatic session restoration on app launch
- ✅ Backend user/organisation data types
- ✅ Maintained existing interface for backwards compatibility

**Migration Notes**:
- `signUp(email, password, orgName)` - Now creates real accounts
- `signIn(email, password)` - Now validates against backend
- `signOut()` - Clears JWT tokens
- Session persists across app restarts via tokens
- `signInWithKeyPass()` - Marked as TODO for backend integration

---

## Authentication Flow

### Signup Flow

```
User enters details
   ↓
AuthContext.signUp()
   ↓
authService.signup()
   ↓
apiService.post('/api/v1/auth/signup')
   ↓
Backend creates user + organisation
   ↓
Returns { user, organisation, accessToken, refreshToken }
   ↓
Tokens saved to AsyncStorage
   ↓
User/Org state updated
   ↓
User navigated to app
```

### Login Flow

```
User enters credentials
   ↓
AuthContext.signIn()
   ↓
authService.login()
   ↓
apiService.post('/api/v1/auth/login')
   ↓
Backend validates credentials
   ↓
Returns { user, organisation, accessToken, refreshToken }
   ↓
Tokens saved to AsyncStorage
   ↓
User/Org state updated
   ↓
User navigated to app
```

### Session Restoration (App Launch)

```
App launches
   ↓
AuthContext mounts
   ↓
restoreSession() called
   ↓
Load cached user, org, tokens from AsyncStorage
   ↓
Verify token valid: GET /api/v1/auth/me
   ↓
If valid: Restore session
   ↓
If invalid: Clear tokens, show login
```

### Token Refresh (Automatic)

```
API request with expired access token
   ↓
Backend returns 401 Unauthorized
   ↓
apiService detects 401 + has refresh token
   ↓
POST /api/v1/auth/refresh with refresh token
   ↓
Backend returns new access token
   ↓
Save new access token
   ↓
Retry original request with new token
   ↓
If refresh fails: Clear all tokens, redirect to login
```

---

## API Response Format

All backend responses follow this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}
```

**Example Success**:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "organisation": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Example Error**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

---

## Testing the Integration

### 1. Start Backend Server

```bash
cd backend
npm run dev
```

Server runs on: `http://localhost:3000`

### 2. Start Frontend App

```bash
cd fraud-risk-app-main
npm start
```

### 3. Test Signup

1. Navigate to signup screen
2. Enter:
   - Email: `test@example.com`
   - Password: `SecurePass123@`
   - Organisation: `Test Org`
3. Submit form
4. **Expected**: Account created, automatically logged in
5. **Verify**: Check backend logs for POST /api/v1/auth/signup

### 4. Test Login

1. Sign out
2. Navigate to login screen
3. Enter same credentials
4. Submit form
5. **Expected**: Successfully logged in
6. **Verify**: Check backend logs for POST /api/v1/auth/login

### 5. Test Session Persistence

1. While logged in, close the app
2. Reopen the app
3. **Expected**: Still logged in, no login screen
4. **Verify**: Check logs for GET /api/v1/auth/me

### 6. Test Token Expiry (Manual)

1. Log in
2. Wait 24 hours OR manually delete access token from AsyncStorage
3. Make any API request
4. **Expected**: Token auto-refreshes, request succeeds
5. **Verify**: Check logs for POST /api/v1/auth/refresh

---

## Environment Configuration

### Development (Current Setup)

**Frontend** (`fraud-risk-app-main/constants/api.ts`):
```typescript
BASE_URL: 'http://localhost:3000'
```

**Backend** (`backend/.env`):
```bash
DATABASE_URL=postgresql://hola@localhost:5432/stopfra_dev
JWT_SECRET=<generated-secret>
PORT=3000
FRONTEND_URL=http://localhost:19006
```

### iOS Simulator

If testing on iOS Simulator, use `localhost` - it can access the host machine's localhost.

### Android Emulator

For Android emulator, you may need to use `10.0.2.2` instead of `localhost`:

```typescript
// In constants/api.ts
const getApiBaseUrl = (): string => {
  if (__DEV__) {
    // For Android emulator
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000';
  }
  return process.env.EXPO_PUBLIC_API_URL || 'https://api.stopfra.com';
};
```

### Physical Device Testing

For testing on physical devices connected to the same WiFi:

1. Get your computer's local IP:
```bash
ipconfig getifaddr en0  # macOS
```

2. Update API base URL:
```typescript
BASE_URL: 'http://192.168.1.XXX:3000'  // Use your actual IP
```

3. Update backend CORS:
```typescript
// backend/src/index.ts
allowedOrigins: [
  'http://localhost:19006',
  'http://192.168.1.XXX:19006',  // Add your IP
]
```

---

## Next Steps

### Phase 1: Complete Core Auth ✅
- [x] API configuration
- [x] API service layer
- [x] Authentication service
- [x] AuthContext integration
- [ ] Test end-to-end authentication flow

### Phase 2: Assessment Integration (Next)
- [ ] Create assessment service (`services/assessment.service.ts`)
- [ ] Update AssessmentContext to use backend
- [ ] Save assessment answers to backend API
- [ ] Submit assessment for risk scoring
- [ ] Display risk register from backend

### Phase 3: Key-Pass Integration
- [ ] Implement key-pass validation endpoint
- [ ] Update signInWithKeyPass to use backend
- [ ] Key-pass allocation after purchase
- [ ] Display key-pass statistics

### Phase 4: Payment Integration
- [ ] Fetch packages from backend
- [ ] Stripe payment integration
- [ ] Purchase confirmation
- [ ] Key-pass allocation after payment

### Phase 5: Dashboard & Analytics
- [ ] Fetch organisation dashboard data
- [ ] Display assessment history
- [ ] Key-pass usage analytics
- [ ] Employee assessment tracking

---

## Troubleshooting

### "Network request failed"

**Cause**: Frontend can't reach backend

**Solutions**:
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check API_CONFIG.BASE_URL matches backend port
3. For physical devices, use local IP instead of localhost
4. Check firewall isn't blocking port 3000

### "AUTH_TOKEN_MISSING"

**Cause**: Request requires authentication but no token provided

**Solutions**:
1. Ensure `requiresAuth: true` is set in API call
2. Check token exists: `await AsyncStorage.getItem('accessToken')`
3. Log in again to get fresh tokens

### "ORGANISATION_ACCESS_DENIED"

**Cause**: User trying to access another organisation's data

**Solutions**:
1. This is expected - multi-tenant security working
2. Ensure user is logged in to correct organisation
3. Verify organisationId matches user's organisationId

### "Token refresh failed"

**Cause**: Refresh token expired (7 days) or invalid

**Solutions**:
1. User needs to log in again
2. Check JWT_REFRESH_SECRET in backend .env
3. Verify refresh token in AsyncStorage

### CORS errors in browser

**Cause**: Frontend origin not whitelisted in backend

**Solutions**:
1. Add origin to backend CORS config (`backend/src/index.ts`)
2. Restart backend server after CORS changes
3. Clear browser cache and try again

---

## File Structure

```
fraud-risk-app-main/
├── constants/
│   └── api.ts                    ✅ API configuration
├── services/
│   ├── api.service.ts            ✅ HTTP client with JWT
│   └── auth.service.ts           ✅ Authentication logic
├── contexts/
│   ├── AuthContext.tsx           ✅ Updated with backend
│   └── AssessmentContext.tsx     ⏳ TODO: Backend integration
└── app/
    ├── auth/
    │   ├── login.tsx             ✅ Uses AuthContext
    │   ├── signup.tsx            ✅ Uses AuthContext
    │   └── keypass.tsx           ⏳ TODO: Backend integration
    └── ...
```

---

## API Endpoints Reference

### Currently Integrated

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/v1/auth/signup` | POST | No | ✅ Integrated |
| `/api/v1/auth/login` | POST | No | ✅ Integrated |
| `/api/v1/auth/logout` | POST | Yes | ✅ Integrated |
| `/api/v1/auth/me` | GET | Yes | ✅ Integrated |
| `/api/v1/auth/refresh` | POST | No | ✅ Integrated |
| `/health` | GET | No | ✅ Integrated |

### Pending Integration

| Endpoint | Method | Auth | Priority |
|----------|--------|------|----------|
| `/api/v1/assessments` | POST | Yes | High |
| `/api/v1/assessments/:id` | GET | Yes | High |
| `/api/v1/assessments/:id` | PATCH | Yes | High |
| `/api/v1/assessments/:id/submit` | POST | Yes | High |
| `/api/v1/keypasses/validate` | POST | No | Medium |
| `/api/v1/keypasses/use` | POST | No | Medium |
| `/api/v1/packages` | GET | No | Medium |
| `/api/v1/purchases` | POST | Yes | Medium |

---

## Security Considerations

### ✅ Implemented

1. **JWT Authentication**: Tokens with 24h/7d expiry
2. **Token Refresh**: Automatic refresh prevents re-login
3. **Secure Storage**: Tokens stored in AsyncStorage (encrypted on device)
4. **HTTPS in Production**: Backend should use HTTPS
5. **Password Strength**: Backend validates password requirements
6. **CORS Protection**: Backend whitelists allowed origins

### ⏳ TODO

1. **Biometric Auth**: Consider FaceID/TouchID for convenience
2. **Token Revocation**: Backend endpoint to revoke refresh tokens
3. **Session Timeout**: Auto-logout after inactivity
4. **Rate Limiting**: Prevent brute force attacks (backend)
5. **Certificate Pinning**: Pin SSL certificates in production

---

## Performance Optimizations

### Already Implemented

1. **Request Timeout**: 30s default prevents hanging requests
2. **Auto-Retry**: Failed requests auto-retry after token refresh
3. **Caching**: User/org data cached in AsyncStorage
4. **Optimistic Updates**: UI updates before API confirms

### Future Optimizations

1. **React Query**: Consider using for server state management
2. **Request Deduplication**: Prevent duplicate simultaneous requests
3. **Background Sync**: Queue requests when offline
4. **Image Caching**: Cache profile images and assets
5. **API Response Caching**: Cache rarely-changing data (packages)

---

## Migration Notes

### Breaking Changes

**Before**: Mock authentication with AsyncStorage only
```typescript
// Old behavior
signUp() // Created local user only
signIn() // Checked local storage only
```

**After**: Real authentication with backend API
```typescript
// New behavior
signUp() // Creates account in database
signIn() // Validates credentials with backend
```

### Backwards Compatibility

The AuthContext interface remains unchanged - existing screens using `useAuth()` will continue to work without modifications.

**Maintained Interface**:
```typescript
const {
  user,
  organisation,
  isLoading,
  isAuthenticated,
  signUp,
  signIn,
  signOut,
} = useAuth();
```

### Data Migration

Existing AsyncStorage data is ignored - users will need to create new accounts or login with backend credentials.

**Old Storage Keys** (deprecated):
- `fra_user_data`
- `fra_org_data`

**New Storage Keys**:
- `accessToken`
- `refreshToken`
- `user`
- `organisation`

---

## Support & Documentation

**Backend API**:
- [Backend README](backend/README.md)
- [Backend Setup Complete](backend/SETUP_COMPLETE.md)
- [API Health Check](http://localhost:3000/health)
- [API Info](http://localhost:3000/api/v1)

**Frontend**:
- [Frontend README](fraud-risk-app-main/README.md)
- [Project Documentation](CLAUDE.MD)

**Testing**:
- Backend: `cd backend && npm run dev`
- Frontend: `cd fraud-risk-app-main && npm start`

---

**Integration completed by**: Claude AI Agent
**Date**: December 21, 2025, 1:00 PM
**Status**: ✅ Ready for testing

**Next Step**: Test authentication flow end-to-end with real backend!
