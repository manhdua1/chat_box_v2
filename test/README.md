# 🧪 ChatBox Testing Suite

**Last Updated:** January 1, 2026

Comprehensive automated testing for the ChatBox real-time chat application.

## 📊 Test Statistics

- **Total Tests:** 74+
- **Integration Tests:** 27
- **Feature Tests:** 22  
- **E2E Tests:** 23
- **Performance Tests:** 2

## 🚀 Quick Start

### Install Dependencies

```bash
npm install

# Install Playwright browsers for E2E tests
npm run install:playwright
```

### Run All Tests

```bash
npm test
```

### Interactive Menu

```bash
# Windows
run-tests.bat

# Linux/Mac
./run-tests.sh
```

## 📝 Available Commands

```bash
# Jest Tests
npm test                  # All tests with coverage
npm run test:watch        # Watch mode
npm run test:integration  # Integration tests only
npm run test:features     # Feature tests only
npm run test:coverage     # Generate coverage report

# E2E Tests (Playwright)
npm run test:e2e          # Headless mode
npm run test:e2e:headed   # With browser UI
npm run test:e2e:debug    # Debug mode

# Performance Tests
npm run test:load         # Artillery load test
npm run test:stress       # 1000 connection stress test
```

## 📁 Test Structure

```
test/
├── integration/          # Backend WebSocket tests
│   └── websocket-integration.test.js
├── features/             # Feature-specific tests
│   ├── chat-features.test.js
│   └── reactions-polls.test.js
├── e2e/                  # Browser automation tests
│   ├── auth-flow.spec.ts
│   └── chat-ui.spec.ts
├── performance/          # Load & stress tests
│   ├── load-test.yml
│   └── stress-test.js
└── utils/                # Test helpers & fixtures
    ├── test-helpers.js
    ├── fixtures.js
    └── jest.setup.js
```

## 🎯 Test Coverage

| Feature | Integration | E2E | Status |
|---------|-------------|-----|--------|
| Authentication | ✅ | ✅ | Full |
| Private Messaging | ✅ | ✅ | Full |
| Group Rooms | ✅ | ✅ | Full |
| Typing Indicators | ✅ | ✅ | Full |
| Online Users | ✅ | ✅ | Full |
| Edit/Delete | ✅ | ✅ | Full |
| Reactions | ✅ | ❌ | Partial |
| Polls | ✅ | ❌ | Partial |
| Message Search | ✅ | ✅ | Full |
| Read Receipts | ✅ | ✅ | Full |

## ⚙️ Prerequisites

Before running tests, ensure:

1. **Backend server** is running on `ws://localhost:8080`
2. **Frontend server** is running on `http://localhost:5173`
3. **MySQL database** is set up with test data

## 📚 Documentation

For comprehensive testing guide, see:
- **[docs/TESTING.md](../docs/TESTING.md)** - Full testing documentation
- **[Walkthrough](../docs/TESTING.md#walkthrough)** - Implementation walkthrough

## 🔧 Configuration

- **Jest:** `jest.config.js`
- **Playwright:** `playwright.config.ts`
- **Coverage Threshold:** 60%

## 💡 Writing Tests

### Integration Test Example

```javascript
import { TestClient, wait } from '../utils/test-helpers.js';

test('should send message', async ()  => {
    const client = new TestClient('user1', 'pass1');
    await client.connect();
    client.login();
    await client.waitForEvent('login_response');
    
    client.sendMessage('Hello!');
    await wait(500);
    
    expect(client.messages[0].content).toBe('Hello!');
    client.disconnect();
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('should login', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/chat/);
});
```

## 🐛 Troubleshooting

### Connection Errors

- Check backend is running: `curl http://localhost:8080`
- Check frontend is running: `curl http://localhost:5173`
- Verify no firewall blocks

### Playwright Installation Issues

```bash
# Reinstall browsers
npx playwright install --force
```

### Memory Issues in Stress Test

```bash
# Increase Node memory
node --max-old-space-size=4096 performance/stress-test.js
```

## 🤝 Contributing

When adding new features:

1. Write integration tests first
2. Add E2E tests for UI features
3. Update test documentation
4. Ensure coverage ≥60%

---

**For detailed information, see [docs/TESTING.md](../docs/TESTING.md)**
