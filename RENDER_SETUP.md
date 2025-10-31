# Render Deployment Setup

## Environment Variables Required

Set these environment variables in your Render dashboard:

### 1. JWT_SECRET
```
JWT_SECRET=fineclem_expense_tracker_secret_key_2024_production
```

### 2. NODE_ENV (Optional)
```
NODE_ENV=production
```

## Steps to Set Environment Variables on Render:

1. Go to your Render dashboard
2. Select your web service
3. Go to "Environment" tab
4. Add the environment variables above
5. Click "Save Changes"
6. Your service will automatically redeploy

## Important Notes:

- **JWT_SECRET must remain consistent** across deployments
- If you change JWT_SECRET, all existing user sessions will be invalidated
- Users will need to log in again after JWT_SECRET changes

## Troubleshooting:

If users are still getting "invalid credentials" after a few minutes:

1. Check Render logs for JWT-related errors
2. Verify JWT_SECRET is set correctly in environment variables
3. Make sure the secret is the same as in your .env file
4. Consider increasing token expiration time (currently 30 days)

## Current Token Settings:

- **Expiration:** 30 days
- **Algorithm:** HS256 (default)
- **Payload:** { id, email, name }