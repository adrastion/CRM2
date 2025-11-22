# Deployment Guide - Martial Arts CRM

Это руководство поможет вам развернуть Martial Arts CRM в production среде.

## 🚀 Варианты развертывания

### 1. Docker Deployment (Рекомендуется)

#### Создание Dockerfile для Backend
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build:server

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
```

#### Docker Compose для полного стека
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: martial_arts_crm
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: .
    environment:
      DATABASE_URL: postgresql://postgres:your_secure_password@postgres:5432/martial_arts_crm
      JWT_SECRET: your_jwt_secret
      NODE_ENV: production
      PORT: 3001
    depends_on:
      - postgres
    ports:
      - "3001:3001"

  frontend:
    build: ./client
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### 2. VPS/Cloud Server Deployment

#### Требования к серверу:
- Ubuntu 20.04+ или CentOS 8+
- 2GB RAM минимум
- 20GB дискового пространства
- Node.js 18+
- PostgreSQL 13+
- Nginx (для reverse proxy)

#### Установка зависимостей:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
sudo apt install nginx -y

# Install PM2 for process management
sudo npm install -g pm2
```

#### Настройка PostgreSQL:
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\q
```

#### Настройка Nginx:
```nginx
# /etc/nginx/sites-available/martial-arts-crm
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/martial-arts-crm/client/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Heroku Deployment

#### Procfile:
```
web: npm start
release: npx prisma migrate deploy
```

#### Heroku CLI команды:
```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy

# Seed database
heroku run npx prisma db seed
```

## 🔧 Production Configuration

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/martial_arts_crm"

# JWT
JWT_SECRET="your-super-secure-jwt-secret-key"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="production"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="noreply@yourdomain.com"

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH="./uploads"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN="https://yourdomain.com"
```

### Security Checklist
- [ ] Используйте HTTPS в production
- [ ] Настройте firewall (только порты 80, 443, 22)
- [ ] Регулярно обновляйте зависимости
- [ ] Используйте сильные пароли для базы данных
- [ ] Настройте backup базы данных
- [ ] Включите логирование
- [ ] Настройте мониторинг

## 📊 Monitoring & Logging

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'martial-arts-crm',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

### Health Check Endpoint
```bash
# Check if application is running
curl http://localhost:3001/health
```

## 🔄 Backup & Recovery

### Database Backup
```bash
# Create backup
pg_dump martial_arts_crm > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql martial_arts_crm < backup_file.sql
```

### Automated Backup Script
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="martial_arts_crm"

# Create backup
pg_dump $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/backup_$DATE.sql s3://your-backup-bucket/
```

## 🚀 CI/CD Pipeline

### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Build application
      run: npm run build
      
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/martial-arts-crm
          git pull origin main
          npm ci --production
          npm run build
          pm2 restart martial-arts-crm
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX idx_trainings_start_time ON trainings(start_time);
CREATE INDEX idx_attendances_client_training ON attendances(client_id, training_id);
```

### Caching
```javascript
// Redis caching example
const redis = require('redis');
const client = redis.createClient();

// Cache dashboard stats
app.get('/api/reports/dashboard', async (req, res) => {
  const cacheKey = `dashboard:${req.tenantId}`;
  const cached = await client.get(cacheKey);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  const stats = await getDashboardStats(req.tenantId);
  await client.setex(cacheKey, 300, JSON.stringify(stats)); // 5 min cache
  
  res.json(stats);
});
```

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U crm_user -d martial_arts_crm
```

#### Application Not Starting
```bash
# Check logs
pm2 logs martial-arts-crm

# Check environment variables
pm2 env 0
```

#### Memory Issues
```bash
# Monitor memory usage
pm2 monit

# Restart if needed
pm2 restart martial-arts-crm
```

## 📞 Support

Для получения помощи с развертыванием:
- Создайте Issue в GitHub
- Отправьте email на support@martialartscrm.com
- Проверьте документацию в README.md

---

**Удачного развертывания!** 🚀
