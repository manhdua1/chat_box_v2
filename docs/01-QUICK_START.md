# Quick Start - Deploy ChatBox1 (Windows)

**Last Updated:** January 1, 2026

## Bước 1: Configure Environment

```powershell
# Copy file cấu hình mẫu
cp config/.env.example config/.env

# Chỉnh sửa config/.env với các thông tin của bạn:
# - MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD
# - JWT_SECRET
# - GEMINI_API_KEY (nếu dùng AI)
```

## Bước 2: Setup Database

```powershell
cd scripts
.\setup_mysql.ps1
```

**Hoặc chạy migrations thủ công:**
```powershell
# Chạy MySQL client và execute các file trong backend/server/migrations/
mysql -u root -p chatbox_db < backend/server/migrations/001_add_message_metadata.sql
```

## Bước 3: Verify

```powershell
# List tables
aws dynamodb list-tables --region ap-southeast-1

# Check Users table GSI
aws dynamodb describe-table --table-name Users --region ap-southeast-1 --query "Table.GlobalSecondaryIndexes[].IndexName"
```

## ✅ Sau khi setup xong AWS:

**Backend cần build trên Linux/EC2 (không thể build trên Windows)**

**Option 1: Build trên EC2 luôn**
```powershell
# SSH to EC2
ssh -i chat-server-key.pem ubuntu@47.129.136.101

# Install dependencies
sudo apt update
sudo apt install -y cmake build-essential libssl-dev libcurl4-openssl-dev

# Upload code to EC2 first
```

**Option 2: Dùng WSL (Windows Subsystem for Linux)**
```powershell
# Install WSL
wsl --install

# Inside WSL, build server
cd /mnt/c/Users/ADMIN/Downloads/ChatBox\ web/backend/server
mkdir build && cd build
cmake ..
make
```

## 🎯 Tôi Recommend:

**Skip building locally → Deploy code to EC2 → Build on EC2**

Tôi có thể hướng dẫn bạn:
1. Upload code to EC2
2. Build on EC2
3. Run server

**Bạn muốn tôi làm cách nào?**
