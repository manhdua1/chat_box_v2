# ChatBox Backend Server - Docker Image
FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    curl \
    zip \
    unzip \
    tar \
    pkg-config \
    libssl-dev \
    libcurl4-openssl-dev \
    zlib1g-dev \
    libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

# Install vcpkg for package management
WORKDIR /opt
RUN git clone https://github.com/Microsoft/vcpkg.git && \
    cd vcpkg && \
    ./bootstrap-vcpkg.sh && \
    ./vcpkg integrate install

# Install required packages
RUN /opt/vcpkg/vcpkg install \
    mysql-connector-cpp \
    openssl \
    curl \
    zlib \
    usockets \
    uwebsockets \
    nlohmann-json \
    jwt-cpp

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Build the server
RUN mkdir -p build && cd build && \
    cmake .. -DCMAKE_TOOLCHAIN_FILE=/opt/vcpkg/scripts/buildsystems/vcpkg.cmake && \
    cmake --build . --config Release

# Expose WebSocket port
EXPOSE 8080

# Run the server
CMD ["./build/chat_server"]
