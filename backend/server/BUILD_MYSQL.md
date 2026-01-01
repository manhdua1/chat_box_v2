# ChatBox Backend - Build Instructions (MySQL Version)

**Last Updated:** January 1, 2026

## Prerequisites

### 1. Install MySQL Server
See `database/MYSQL_SETUP.md` for instructions

### 2. Install vcpkg (Package Manager)
```powershell
git clone https://github.com/Microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat
.\vcpkg integrate install
```

### 3. Install Dependencies
```powershell
# MySQL Connector
 .\vcpkg install mysql-connector-cpp:x64-windows

# Other dependencies
.\vcpkg install openssl:x64-windows
.\vcpkg install curl:x64-windows
.\vcpkg install zlib:x64-windows
```

## Build Steps

### 1. Configure CMake
```powershell
cd backend\server
mkdir build
cd build

cmake .. -DCMAKE_TOOLCHAIN_FILE=[path-to-vcpkg]/scripts/buildsystems/vcpkg.cmake
```

### 2. Build
```powershell
cmake --build . --config Release
```

### 3. Run
```powershell
cd Release
.\chat_server.exe
```

## Configuration

Copy `.env.mysql` to `.env` and update:
```ini
MYSQL_HOST=localhost
MYSQL_USER=chatbox
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=chatbox_db
```

## Troubleshooting

### CMake can't find MySQL
```powershell
# Verify installation
.\vcpkg list | findstr mysql

# Reinstall if needed
.\vcpkg remove mysql-connector-cpp:x64-windows
.\vcpkg install mysql-connector-cpp:x64-windows
```

### Link errors
Make sure using x64-windows triplet and matching configurations
