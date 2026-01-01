# Deployment Guide

**Last Updated:** January 1, 2026

Complete guide for deploying ChatBox to production.

## 🎯 Deployment Options

### 1. Local/On-Premise Deployment
**Best for:** Testing, development, small teams

### 2. AWS EC2 Deployment
**Best for:** Production, scalability, cloud infrastructure

### 3. Docker Deployment
**Best for:** Containerized environments, Kubernetes

---

## 📋 Prerequisites

### Common Requirements:
- MySQL 8.0+
- Domain name (optional, for HTTPS)
- SSL certificate (for production)

### For AWS EC2:
- AWS account
- EC2 instance (t2.micro minimum)
- Security groups configured
- Elastic IP (recommended)

---

## 🚀 Quick Deployment (Local)

### 1. Backend Setup

```bash
# Navigate to backend
cd backend/server

# Configure MySQL
mysql -u root -p < sql/01_create_schema.sql
mysql -u root -p < sql/02_add_edit_delete_columns.sql
mysql -u root -p < sql/03_add_rooms_tables.sql

# Build server
cd build
cmake ..
cmake --build . --config Release

# Run server
./Release/chat_server.exe  # Windows
./chat_server              # Linux
```

### 2. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Serve with nginx or serve
npx serve -s dist -p 5173
```

### 3. Configure Environment

Create `config/.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=chatbox_db

# Server
WS_PORT=8080
FRONTEND_URL=http://localhost:5173

# Security
JWT_SECRET=your-secret-key-here
```

---

## ☁️ AWS EC2 Deployment

### Step 1: Launch EC2 Instance

```bash
# Instance type: t2.small or better
# OS: Ubuntu 22.04 LTS
# Storage: 20GB minimum
```

### Step 2: Configure Security Groups

**Inbound Rules:**
```
Port 22    - SSH (your IP only)
Port 80    - HTTP (0.0.0.0/0)
Port 443   - HTTPS (0.0.0.0/0)
Port 8080  - WebSocket (0.0.0.0/0)
Port 3306  - MySQL (localhost only)
```

### Step 3: Connect and Setup

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y build-essential cmake nodejs npm mysql-server

# Clone repository
git clone <your-repo>
cd "ChatBox web"
```

### Step 4: Setup MySQL

```bash
# Secure MySQL
sudo mysql_secure_installation

# Create database
sudo mysql -u root -p < backend/server/sql/01_create_schema.sql
```

### Step 5: Build and Run

```bash
# Build backend
cd backend/server/build
cmake ..
cmake --build . --config Release

# Build frontend
cd ../../../frontend
npm install
npm run build

# Use PM2 for process management
sudo npm install -g pm2

# Start backend
pm2 start backend/server/build/chat_server --name chatbox-server

# Start frontend (with serve)
pm2 start "npx serve -s dist -p 5173" --name chatbox-frontend

# Save PM2 config
pm2 save
pm2 startup
```

### Step 6: Setup Nginx (Optional)

```bash
# Install nginx
sudo apt install nginx

# Configure nginx
sudo nano /etc/nginx/sites-available/chatbox
```

**Nginx config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/chatbox /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 SSL/HTTPS Setup

### Using Let's Encrypt (Free):

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

---

## 🐳 Docker Deployment

### Docker Compose Setup

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: your_password
      MYSQL_DATABASE: chatbox_db
    volumes:
      - mysql_data:/var/lib/mysql
      - ./backend/server/sql:/docker-entrypoint-initdb.d
    ports:
      - "3306:3306"

  backend:
    build: ./backend/server
    ports:
      - "8080:8080"
    depends_on:
      - mysql
    environment:
      DB_HOST: mysql
      DB_PORT: 3306

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  mysql_data:
```

Deploy:
```bash
docker-compose up -d
```

---

## 📊 Monitoring

### Server Health Checks

```bash
# Check backend
curl http://localhost:8080/health

# Check frontend
curl http://localhost:5173

# View logs
pm2 logs chatbox-server
pm2 logs chatbox-frontend

# Monitor resources
pm2 monit
```

### Database Monitoring

```bash
# MySQL status
sudo systemctl status mysql

# Check connections
mysql -u root -p -e "SHOW PROCESSLIST;"
```

---

## 🔄 Updates and Maintenance

### Updating Code

```bash
# Pull latest
git pull origin main

# Rebuild backend
cd backend/server/build
cmake --build . --config Release

# Rebuild frontend
cd ../../../frontend
npm install
npm run build

# Restart services
pm2 restart all
```

### Database Migrations

```bash
# Run new migrations
mysql -u root -p chatbox_db < sql/new_migration.sql
```

### Backup

```bash
# Backup database
mysqldump -u root -p chatbox_db > backup_$(date +%Y%m%d).sql

# Backup code
tar -czf chatbox_backup.tar.gz "ChatBox web/"
```

---

## 🐛 Troubleshooting

### Common Issues:

**WebSocket Connection Failed:**
- Check firewall rules
- Verify port 8080 is open
- Check CORS settings

**Database Connection Error:**
- Verify MySQL is running
- Check credentials in .env
- Ensure database exists

**Frontend Build Fails:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node version: `node -v` (should be 18+)

---

## 📈 Performance Optimization

### Backend:
- Use connection pooling
- Enable MySQL query cache
- Optimize database indexes

### Frontend:
- Enable gzip compression in nginx
- Use CDN for static assets
- Enable browser caching

### Network:
- Use HTTP/2
- Enable websocket compression
- Optimize payload size

---

## ✅ Production Checklist

- [ ] SSL/HTTPS enabled
- [ ] Firewall configured
- [ ] Database secured
- [ ] Backups automated
- [ ] Monitoring setup
- [ ] Error logging enabled
- [ ] PM2/systemd for auto-restart
- [ ] Environment variables secured
- [ ] .pem files in .gitignore
- [ ] Health checks configured

---

## 📞 Support

For deployment issues:
1. Check logs: `pm2 logs`
2. Review documentation
3. Check GitHub issues

---

**Deployment scripts:** See [scripts/](../scripts/) folder for automated deployment helpers.
