# ⚙️ ChatBox1 Configuration

**Last Updated:** January 1, 2026

## 📁 Files

```
config/
├── .env              # Actual credentials (PRIVATE!)
├── .env.example      # Template (safe to commit)
└── .gitignore        # Security rules
```

## 🔐 Environment Variables

### **.env** (NEVER COMMIT!)

Contains sensitive data:
- AWS credentials
- Gemini API key
- JWT secret
- Server configuration

**Location:** This file
**Git:** Blocked by .gitignore

### **.env.example** (Safe to share)

Template for team members.

**Usage:**
```bash
cp .env.example .env
# Then edit .env with actual credentials
```

## 🔒 Security

**.gitignore** blocks:
- `.env` files
- AWS credential files
- SSH keys (*.pem, *.ppk)
- Build artifacts

## 📝 Required Variables

See `.env.example` for complete list:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `GEMINI_API_KEY`
- `JWT_SECRET` (MUST generate!)
- `SERVER_IP`, `SERVER_PORT`

## 🚨 Important

1. Generate JWT_SECRET:
   ```bash
   openssl rand -base64 32
   ```

2. Never commit `.env` to Git!

3. Rotate credentials regularly

See `../docs/SECURITY_WARNING.md` for details.
