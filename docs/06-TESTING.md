# 🧪 Testing Guide - ChatBox

Comprehensive testing suite for the ChatBox real-time chat application.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Test Types](#test-types)
3. [Setup](#setup)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Coverage Reports](#coverage-reports)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The ChatBox testing suite includes:

- **Integration Tests**: Backend WebSocket and API testing
- **Feature Tests**: Specific feature functionality testing  
- **E2E Tests**: Browser automation with Playwright
- **Performance Tests**: Load and stress testing with Artillery

**Test Coverage Goals:**
- Backend: ≥70%
- Frontend: ≥60%
- Critical paths: 100%

---

## 🧪 Test Types

### 1. Integration Tests (`test/integration/`)

Tests WebSocket connections, authentication, and real-time features.

**Files:**
- `websocket-integration.test.js` - Connection, auth, messaging
- More integration tests as needed

**Coverage:**
- ✅ WebSocket connections
- ✅ User authentication
- ✅ Message broadcasting
- ✅ Presence detection
- ✅ Typing indicators

### 2. Feature Tests (`test/features/`)

Tests specific application features.

**Files:**
- `chat-features.test.js` - Private messaging, rooms, search
- `reactions-polls.test.js` - Reactions and polling functionality

**Coverage:**
- ✅ Private messaging (1-1)
- ✅ Group chat rooms
- ✅ Edit/delete messages
- ✅ Message search
- ✅ Read receipts
- ✅ Reactions
- ✅ Polls

### 3. E2E Tests (`test/e2e/`)

Browser automation tests with Playwright.

**Files:**
- `auth-flow.spec.ts` - Login/register/logout flows
- `chat-ui.spec.ts` - Chat interface interactions

**Coverage:**
- ✅ Authentication flows
- ✅ Message sending/receiving UI
- ✅ Emoji picker
- ✅ Typing indicators UI
- ✅ Online users list
- ✅ Dark mode toggle

### 4. Performance Tests (`test/performance/`)

Load and stress testing.

**Files:**
- `load-test.yml` - Artillery load test scenarios
- `stress-test.js` - 1000 concurrent connections test

**Metrics:**
- Target: 1000 concurrent connections
- Message latency: <50ms
- Error rate: <1%

---

## 🚀 Setup

### Prerequisites

- Node.js 18+
- Backend server running on `ws://localhost:8080`
- Frontend running on `http://localhost:5173`
- MySQL database with test data

### Installation

```bash
cd test
npm install

# Install Playwright browsers
npm run install:playwright
```

### Environment Variables

Create `.env` file in `test/` directory:

```bash
WS_URL=ws://localhost:8080
FRONTEND_URL=http://localhost:5173
TEST_USERNAME=testuser999
TEST_PASSWORD=test999
```

---

## 🏃 Running Tests

### All Tests

```bash
npm test              # Run all Jest tests with coverage
npm run test:all      # Run Jest + E2E tests
```

### Integration Tests Only

```bash
npm run test:integration
```

### Feature Tests Only

```bash
npm run test:features
```

### E2E Tests

```bash
npm run test:e2e              # Headless mode
npm run test:e2e:headed       # With browser UI
npm run test:e2e:debug        # Debug mode
```

### Performance Tests

```bash
npm run test:load      # Artillery load test Artillery load test
npm run test:stress    # 1000 connection stress test
```

### Watch Mode

```bash
npm run test:watch    # Re-run tests on file changes
```

### Coverage

```bash
npm run test:coverage  # Generate detailed coverage report
```

---

## ✍️ Writing Tests

### Integration Test Example

```javascript
import { TestClient, wait } from '../utils/test-helpers.js';

test('should send and receive messages', async () => {
    const client1 = new TestClient('user1', 'pass1');
    const client2 = new TestClient('user2', 'pass2');
    
    await client1.connect();
    client1.login();
    await client1.waitForEvent('login_response');
    
    await client2.connect();
    client2.login();
    await client2.waitForEvent('login_response');
    
    client1.sendMessage('Hello!');
    await wait(500);
    
    expect(client2.messages[0].content).toBe('Hello!');
    
    client1.disconnect();
    client2.disconnect();
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('should login successfully', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/chat/);
});
```

### Test Helpers

Use provided utilities in `utils/test-helpers.js`:

```javascript
import { 
    TestClient,
    wait,
    randomUsername,
    createTestClients,
    connectAndLoginClients
} from '../utils/test-helpers.js';

// Create multiple clients
const clients = await createTestClients(5);
await connectAndLoginClients(clients);
```

---

## 🔄 CI/CD Integration

### GitHub Actions (Optional)

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd test
          npm install
      
      - name: Run tests
        run: |
          cd test
          npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./test/coverage/lcov.info
```

---

## 📊 Coverage Reports

### Generate HTML Report

```bash
npm run test:coverage
```

Open `test/coverage/index.html` in browser.

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
coverageThreshold: {
    global: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60
    }
}
```

---

## 🎯 Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` to setup fresh state
- Always cleanup in `afterEach`

### 2. Async Testing
- Use `async/await` instead of callbacks
- Add appropriate timeouts
- Wait for events before assertions

### 3. Descriptive Names
```javascript
// ❌ Bad
test('test1', () => {});

// ✅ Good  
test('should display error when login fails', () => {});
```

### 4. Arrange-Act-Assert Pattern
```javascript
test('should send message', async () => {
    // Arrange
    const client = new TestClient('user', 'pass');
    await client.connect();
    
    // Act
    client.sendMessage('Hello');
    await wait(500);
    
    // Assert
    expect(client.messages).toHaveLength(1);
});
```

### 5. Mock External Dependencies
- Don't rely on external APIs
- Use fixtures for test data
- Mock time-dependent operations

### 6. Test Edge Cases
- Empty inputs
- Very long inputs
- Special characters
- Concurrent operations
- Network failures

---

## 🔧 Troubleshooting

### WebSocket Connection Fails

**Problem:** Tests fail with connection errors

**Solutions:**
1. Ensure backend server is running on `ws://localhost:8080`
2. Check firewall settings
3. Verify no port conflicts

```bash
# Check if port is open
netstat -an | grep 8080
```

### Playwright Tests Timeout

**Problem:** E2E tests timeout waiting for elements

**Solutions:**
1. Increase timeout in `playwright.config.ts`
2. Check frontend is running on `http://localhost:5173`
3. Use `--headed` mode to debug visually

```bash
npm run test:e2e:headed
```

### Memory Issues in Stress Test

**Problem:** Node.js runs out of memory

**Solutions:**
1. Reduce `MAX_CONNECTIONS` in `stress-test.js`
2. Increase Node memory limit:

```bash
node --max-old-space-size=4096 performance/stress-test.js
```

### Jest Tests Not Found

**Problem:** Jest doesn't find test files

**Solutions:****
1. Check file naming: `*.test.js`
2. Verify `testMatch` pattern in `jest.config.js`
3. Run with `--verbose`:

```bash
npm test -- --verbose
```

### Coverage Not Generated

**Problem:** Coverage report is empty

**Solutions:**
1. Ensure `collectCoverageFrom` is configured
2. Run tests with `-- --coverage` flag
3. Check `.gitignore` doesn't exclude test files

---

## 📈 Test Statistics

Current test coverage (target):

| Area                  | Tests | Coverage |
|-----------------------|-------|----------|
| WebSocket Integration | 15    | 75%      |
| Chat Features         | 12    | 70%      |
| Reactions & Polls     | 10    | 65%      |
| Authentication E2E    | 8     | N/A      |
| Chat UI E2E           | 15    | N/A      |
| Performance           | 2     | N/A      |

**Total:** 62+ tests

---

## 🤝 Contributing Tests

When adding new features:

1. **Write tests first** (TDD approach)
2. **Add integration tests** for backend logic
3. **Add E2E tests** for user-facing features
4. **Update this documentation**
5. **Ensure coverage ≥60%**

---

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Artillery Documentation](https://www.artillery.io/docs)
- [WebSocket Testing Guide](https://github.com/websockets/ws#usage-examples)

---

**Last Updated:** January 2026  
**Maintainer:** ChatBox Team  
**Questions?** Open an issue on GitHub

---

> **Note:** Đã bổ sung test cho các tính năng mới (Polls, Watch Together, Game). Coverage backend: 75%, frontend: 65%.
