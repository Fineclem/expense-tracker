# Design Document

## Overview

This design standardizes username storage to use user-specific localStorage keys throughout the expense tracker application. The solution eliminates duplicate storage methods, ensures data isolation between users, and provides a consistent API for username management.

## Architecture

### Current State Analysis
- **auth.js**: Uses global localStorage key `username` 
- **app.js**: Contains duplicate storage methods (both user-specific and global)
- **Inconsistency**: Different parts of the app use different storage approaches
- **Risk**: Potential data conflicts when multiple users share a browser

### Target Architecture
- **Centralized Storage**: Single storage helper with user-specific methods only
- **Consistent API**: All components use the same storage interface
- **User Isolation**: Each user's data is stored with unique keys based on their token
- **Graceful Fallbacks**: Robust error handling and data validation

## Components and Interfaces

### 1. Enhanced Storage Helper (app.js)

#### Issues Found in Current Implementation:
- **Duplicate Methods**: Two `saveUsername()` and `loadUsername()` methods exist (lines 108-149)
- **Mixed Storage**: One uses `getUserKey('username')`, other uses global `'username'`
- **Inconsistent Cleanup**: `clearUserData()` removes global `'username'` but not user-specific keys
- **Method Conflicts**: Both methods have same names causing confusion

#### Cleaned Up Storage Helper:
```javascript
const storage = {
  // Core user key generation (existing - keep as is)
  getUserKey(key) {
    const token = localStorage.getItem("token");
    if (!token) return key;
    
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const userId = tokenData.id || tokenData.userId || 'default';
      return `${key}_${userId}`;
    } catch (err) {
      return `${key}_default`;
    }
  },
  
  // Username management (user-specific only) - REMOVE DUPLICATES
  saveUsername(username) {
    try {
      localStorage.setItem(this.getUserKey('username'), username);
      console.log('Username saved to localStorage:', username);
    } catch (err) {
      console.error('Failed to save username to localStorage:', err);
    }
  },
  
  loadUsername() {
    try {
      const stored = localStorage.getItem(this.getUserKey('username'));
      return stored || 'User';
    } catch (err) {
      console.error('Failed to load username from localStorage:', err);
      return 'User';
    }
  },
  
  // Migration helper for existing global usernames
  migrateGlobalUsername() {
    try {
      const globalUsername = localStorage.getItem('username');
      if (globalUsername && globalUsername !== 'User') {
        this.saveUsername(globalUsername);
        localStorage.removeItem('username');
        console.log('Migrated global username to user-specific storage');
      }
    } catch (err) {
      console.error('Failed to migrate global username:', err);
    }
  },
  
  // Fixed clearUserData method
  clearUserData() {
    try {
      localStorage.removeItem(this.getUserKey('expenses'));
      localStorage.removeItem(this.getUserKey('budget'));
      localStorage.removeItem(this.getUserKey('username')); // ← Fix: use user-specific key
      console.log('User data cleared from localStorage');
    } catch (err) {
      console.error('Failed to clear user data from localStorage:', err);
    }
  }
}
```

### 2. Updated Authentication System (auth.js)

#### Current Implementation Analysis
```javascript
// Current login handler (lines 308-312)
.then((data) => {
  localStorage.setItem("token", data.token);
  
  // Save username to localStorage for dashboard use
  const userName = data.user?.name || data.user?.username || data.user?.displayName || "User";
  localStorage.setItem("username", userName);  // ← Global storage (needs fixing)
  console.log("Username saved during login:", userName);
  
  showSuccess("Login successful! Redirecting...");
})
```

#### Updated Implementation
```javascript
// Updated login handler - integrate storage helper
.then((data) => {
  localStorage.setItem("token", data.token);
  
  // Extract username with same logic but use storage helper
  const userName = data.user?.name || data.user?.username || data.user?.displayName || "User";
  
  // Import storage helper from app.js or create shared utility
  if (window.storage && window.storage.saveUsername) {
    window.storage.saveUsername(userName);
  } else {
    // Fallback: create user-specific key manually
    const token = data.token;
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const userId = tokenData.id || tokenData.userId || 'default';
      localStorage.setItem(`username_${userId}`, userName);
    } catch (err) {
      localStorage.setItem('username_default', userName);
    }
  }
  
  console.log("Username saved during login:", userName);
  showSuccess("Login successful! Redirecting...");
})
```

#### Integration Strategy
Since auth.js and app.js are separate modules, we'll use **Option A** (simplest):

1. **Export storage helper**: Make `storage` object available on `window` in app.js
2. **Import in auth.js**: Use `window.storage` if available, fallback to manual implementation
3. **Consistent logic**: Use same username extraction pattern in both files

```javascript
// In app.js - make storage available globally
window.storage = storage;

// In auth.js - use global storage helper
const getUserSpecificKey = (key) => {
  const token = localStorage.getItem("token");
  if (!token) return `${key}_default`;
  
  try {
    const tokenData = JSON.parse(atob(token.split('.')[1]));
    const userId = tokenData.id || tokenData.userId || 'default';
    return `${key}_${userId}`;
  } catch (err) {
    return `${key}_default`;
  }
};

const saveUserSpecificUsername = (username) => {
  if (window.storage && window.storage.saveUsername) {
    window.storage.saveUsername(username);
  } else {
    // Fallback implementation
    localStorage.setItem(getUserSpecificKey('username'), username);
  }
};
```

### 3. Dashboard Integration (app.js)

#### Current Implementation Issues:
- `checkAuth()` function (lines 282-308) already uses `storage.loadUsername()` correctly
- `updateUserInfo()` function (lines 164-184) calls both `storage.loadUsername()` and `storage.saveUsername()`
- Need to ensure migration happens before first load

#### Updated Implementation:
```javascript
function checkAuth() {
  const token = localStorage.getItem("token");
  
  if (!token) {
    window.location.href = "/login";
    return;
  }

  // Migrate any existing global username first
  storage.migrateGlobalUsername();
  
  // Try to load username from user-specific storage
  const storedUsername = storage.loadUsername();
  
  if (storedUsername && storedUsername !== 'User') {
    console.log("Using stored username:", storedUsername);
    updateUserInfo(storedUsername);
    loadDashboardData();
    setCurrentDate();
    displayCurrentDate();
    updateDailyIcon();
    initializeEventListeners();
    return;
  }

  // If no stored username, fetch from API
  api("/me")
    .then((data) => {
      const userName = data.user?.name || data.user?.username || data.user?.displayName || "User";
      storage.saveUsername(userName);
      updateUserInfo(userName);
      loadDashboardData();
      setCurrentDate();
      displayCurrentDate();
      updateDailyIcon();
      initializeEventListeners();
    })
    .catch((err) => {
      console.error("Authentication error:", err);
      localStorage.removeItem("token");
      window.location.href = "/login";
    });
}

function updateUserInfo(userName = "") {
  console.log("updateUserInfo called with:", userName);
  
  // Use provided username or load from storage
  const displayName = userName || storage.loadUsername();
  
  // Save username to localStorage for future use (only if new username provided)
  if (userName && userName !== 'User') {
    storage.saveUsername(userName);
  }
  
  // Update sidebar user info
  const userNameSidebar = document.getElementById("user-name-sidebar");
  if (userNameSidebar) {
    userNameSidebar.textContent = `Welcome, ${displayName.toUpperCase()}!`;
    console.log("Updated sidebar with:", displayName);
  } else {
    console.error("user-name-sidebar element not found");
  }
}
```

## Data Models

### Username Storage Model
```javascript
{
  key: "username_{userId}",           // User-specific localStorage key
  value: {
    username: string,                 // The actual username
    timestamp: ISO8601,               // When it was stored
    version: "1.0"                    // Schema version for future migrations
  }
}
```

### User Key Generation
```javascript
// Extract user ID from JWT token payload
const getUserId = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload.userId || payload.sub || 'default';
  } catch (err) {
    return 'default';
  }
}
```

## Error Handling

### Storage Failures
- **localStorage unavailable**: Graceful degradation to in-memory storage
- **Quota exceeded**: Clear old data and retry
- **Invalid token**: Use 'default' user ID as fallback
- **Corrupted data**: Clear and re-fetch from API

### Migration Strategy
1. **Detection**: Check for existing global username on app load
2. **Migration**: Move global username to user-specific storage
3. **Cleanup**: Remove old global key after successful migration
4. **Validation**: Verify migration success before proceeding

## Testing Strategy

### Unit Tests
- Storage helper methods (save/load username)
- User key generation with various token formats
- Error handling for storage failures
- Migration logic for existing global usernames

### Integration Tests
- End-to-end login flow with username storage
- Dashboard load with cached username
- Multi-user scenario testing
- Storage cleanup on logout

### Edge Cases
- Invalid or expired tokens
- localStorage disabled/unavailable
- Corrupted username data
- Missing user information in API response

## Implementation Phases

### Phase 1: Create Shared Storage Utility
- Create getUserSpecificKey() helper function
- Make storage helper available to both auth.js and app.js
- Implement consistent username extraction logic

### Phase 2: Update Authentication System (auth.js)
- Replace `localStorage.setItem("username", userName)` with user-specific storage
- Use the same username extraction logic: `data.user?.name || data.user?.username || data.user?.displayName || "User"`
- Ensure storage helper is accessible from auth.js context

### Phase 3: Clean Up Dashboard Storage (app.js)
- Remove duplicate saveUsername/loadUsername methods (lines 130-149) from storage object
- Keep only user-specific storage methods (lines 108-128)
- Fix clearUserData method to use user-specific username key
- Add migration logic for existing global usernames
- Export storage object to window for auth.js access

### Phase 4: Update Dashboard Integration
- Modify checkAuth function to use cleaned-up storage helper
- Ensure consistent fallback behavior
- Add validation for loaded username data

### Phase 5: Testing and Migration
- Test login flow with user-specific username storage
- Verify dashboard loads username correctly
- Test multi-user scenarios
- Implement migration for existing global usernames

## Security Considerations

### Data Isolation
- Each user's username is stored with a unique key
- No cross-user data access possible
- Token-based user identification prevents spoofing

### Privacy Protection
- Username data is only accessible to the authenticated user
- No sensitive information stored in localStorage keys
- Automatic cleanup on logout prevents data persistence

### Token Security
- User ID extraction from JWT payload only
- No token storage in username data
- Graceful handling of invalid/expired tokens