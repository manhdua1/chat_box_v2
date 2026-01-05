# Hướng Dẫn Chạy ChatBox với Docker

**Cập nhật:** 5 Tháng 1, 2026

## 📋 Yêu Cầu

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM khả dụng
- 10GB dung lượng ổ cứng

## 🚀 Khởi Động Nhanh

### 1. Cài Đặt Docker

**Ubuntu/Debian:**
```bash
# Cập nhật package
sudo apt-get update

# Cài đặt Docker
sudo apt-get install -y docker.io docker-compose

# Thêm user vào docker group (để không cần sudo)
sudo usermod -aG docker $USER
newgrp docker
```

**Kiểm tra cài đặt:**
```bash
docker --version
docker-compose --version
```

### 2. Chạy ChatBox

```bash
# Di chuyển vào thư mục dự án
cd /home/manhdua/adu/chat_box_v2

# Khởi động tất cả services
docker-compose up -d

# Xem logs
docker-compose logs -f
```

### 3. Truy Cập Ứng Dụng

- **Frontend:** http://localhost:5173
- **Backend WebSocket:** ws://localhost:8080
- **MySQL:** localhost:3306

**Tài khoản test:**
- Username: `test1`
- Password: `test123`

---

## 🔧 Các Lệnh Quản Lý

### Xem Trạng Thái Services

```bash
# Xem các container đang chạy
docker-compose ps

# Xem logs của tất cả services
docker-compose logs

# Xem logs của backend
docker-compose logs backend

# Xem logs của MySQL
docker-compose logs mysql

# Theo dõi logs real-time
docker-compose logs -f backend
```

### Khởi Động/Dừng Services

```bash
# Khởi động tất cả
docker-compose up -d

# Khởi động chỉ backend và MySQL
docker-compose up -d mysql backend

# Dừng tất cả
docker-compose down

# Dừng và xóa volumes (XÓA DATABASE!)
docker-compose down -v

# Khởi động lại một service
docker-compose restart backend
```

### Build Lại Images

```bash
# Build lại tất cả
docker-compose build

# Build lại chỉ backend
docker-compose build backend

# Build và khởi động
docker-compose up -d --build
```

### Truy Cập Container

```bash
# Vào container backend
docker-compose exec backend /bin/bash

# Vào MySQL
docker-compose exec mysql mysql -u chatbox -p chatbox_db

# Chạy lệnh trong container
docker-compose exec backend ls -la
```

---

## 🗄️ Quản Lý Database

### Kết Nối MySQL

```bash
# Từ host machine
mysql -h localhost -P 3306 -u chatbox -p

# Password: chatbox_password
```

### Chạy Migrations

```bash
# Copy migration files vào container
docker-compose exec mysql bash

# Trong container
cd /docker-entrypoint-initdb.d/migrations
mysql -u chatbox -p chatbox_db < 001_add_message_metadata.sql
```

### Backup Database

```bash
# Backup
docker-compose exec mysql mysqldump -u chatbox -p chatbox_db > backup.sql

# Restore
docker-compose exec -T mysql mysql -u chatbox -p chatbox_db < backup.sql
```

### Xem Dữ Liệu

```bash
# Vào MySQL CLI
docker-compose exec mysql mysql -u chatbox -p chatbox_db

# Trong MySQL CLI
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM messages LIMIT 10;
```

---

## ⚙️ Cấu Hình

### Thay Đổi Ports

Sửa file `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "9090:8080"  # Đổi port backend thành 9090
  
  frontend:
    ports:
      - "3000:5173"  # Đổi port frontend thành 3000
```

### Thay Đổi MySQL Password

Sửa trong `docker-compose.yml`:

```yaml
services:
  mysql:
    environment:
      MYSQL_ROOT_PASSWORD: your_new_root_password
      MYSQL_PASSWORD: your_new_password
  
  backend:
    environment:
      MYSQL_PASSWORD: your_new_password
```

**Lưu ý:** Phải xóa volume cũ:
```bash
docker-compose down -v
docker-compose up -d
```

### Persistent Data

Dữ liệu MySQL được lưu trong Docker volume:

```bash
# Xem volumes
docker volume ls

# Xem chi tiết volume
docker volume inspect chat_box_v2_mysql_data

# Xóa volume (XÓA TẤT CẢ DỮ LIỆU!)
docker volume rm chat_box_v2_mysql_data
```

---

## 🐛 Xử Lý Lỗi

### Backend không khởi động

```bash
# Xem logs chi tiết
docker-compose logs backend

# Kiểm tra MySQL đã sẵn sàng
docker-compose exec mysql mysqladmin ping -h localhost

# Restart backend
docker-compose restart backend
```

### MySQL connection refused

```bash
# Chờ MySQL khởi động hoàn toàn (có thể mất 30-60 giây)
docker-compose logs mysql | grep "ready for connections"

# Kiểm tra health check
docker-compose ps
```

### Port đã được sử dụng

```bash
# Tìm process đang dùng port
sudo lsof -i :8080
sudo lsof -i :3306

# Kill process
sudo kill -9 <PID>
```

### Build thất bại

```bash
# Clean build
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Hết dung lượng đĩa

```bash
# Xóa containers không dùng
docker container prune

# Xóa images không dùng
docker image prune -a

# Xóa volumes không dùng
docker volume prune

# Xóa tất cả (CẨNTHẬN!)
docker system prune -a --volumes
```

---

## 📊 Monitoring

### Xem Resource Usage

```bash
# Xem CPU, RAM usage
docker stats

# Xem của một container
docker stats chatbox_backend
```

### Health Checks

```bash
# Kiểm tra MySQL
docker-compose exec mysql mysqladmin ping -h localhost

# Kiểm tra backend (nếu có health endpoint)
curl http://localhost:8080/health

# Kiểm tra frontend
curl http://localhost:5173
```

---

## 🔒 Production Setup

### 1. Sử Dụng Environment Files

Tạo file `.env`:

```env
# MySQL
MYSQL_ROOT_PASSWORD=strong_root_password_here
MYSQL_PASSWORD=strong_password_here

# Backend
JWT_SECRET=your_jwt_secret_here
GEMINI_API_KEY=your_api_key_here
```

Cập nhật `docker-compose.yml`:

```yaml
services:
  mysql:
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
```

### 2. Sử Dụng Nginx Reverse Proxy

```yaml
# Thêm vào docker-compose.yml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
      - frontend
```

### 3. Enable HTTPS

```bash
# Sử dụng Let's Encrypt
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d yourdomain.com
```

---

## 📝 Development Tips

### Hot Reload cho Frontend

Sửa `docker-compose.yml`:

```yaml
  frontend:
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev
```

### Debug Backend

```bash
# Build với debug symbols
docker-compose exec backend bash
cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug
cmake --build .
```

### Chạy Tests

```bash
# Chạy tests trong container
docker-compose exec backend ./build/test/run_tests

# Hoặc từ host
cd test
npm test
```

---

## 🎯 Next Steps

1. ✅ Khởi động Docker containers
2. ⚙️ Cấu hình environment variables
3. 🔐 Setup SSL/HTTPS cho production
4. 📊 Cài đặt monitoring tools
5. 🔄 Setup CI/CD pipeline
6. 💾 Thiết lập backup tự động

---

## 📚 Tài Liệu Tham Khảo

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MySQL Docker Hub](https://hub.docker.com/_/mysql)
- [Project README](README.md)
- [Deployment Guide](docs/03-DEPLOYMENT.md)

---

## ❓ Câu Hỏi Thường Gặp

**Q: Làm sao để reset database?**
```bash
docker-compose down -v
docker-compose up -d
```

**Q: Làm sao để update code?**
```bash
git pull
docker-compose up -d --build
```

**Q: Làm sao để xem password MySQL?**
```bash
# Xem trong docker-compose.yml
grep MYSQL_PASSWORD docker-compose.yml
```

**Q: Container backend bị crash liên tục?**
```bash
# Xem logs để tìm lỗi
docker-compose logs backend
# Thường do MySQL chưa sẵn sàng, chờ thêm vài giây
```

---

**Happy Coding! 🚀**
