#!/bin/bash

# Автоматический деплой Inigma в Cloudflare Workers
# Использование: ./deploy.sh [production|development]

set -e

ENV=${1:-production}
echo "🚀 Deploying Inigma to Cloudflare Workers (environment: $ENV)"

# Проверка установки wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI не установлен. Установите его с помощью: npm install -g wrangler"
    exit 1
fi

# Проверка аутентификации
if ! wrangler whoami &> /dev/null; then
    echo "❌ Вы не аутентифицированы в Cloudflare. Выполните: wrangler login"
    exit 1
fi

# Установка зависимостей
echo "📦 Installing dependencies..."
npm install

# Сборка проекта
echo "🔨 Building project..."
npm run build

# Создание R2 bucket если не существует
echo "🪣 Checking R2 bucket..."
if ! wrangler r2 bucket list | grep -q "inigma-storage"; then
    echo "📁 Creating R2 bucket: inigma-storage"
    wrangler r2 bucket create inigma-storage
else
    echo "✅ R2 bucket already exists"
fi

# Деплой
echo "🚀 Deploying to Cloudflare Workers..."
cd build

if [ "$ENV" = "production" ]; then
    wrangler deploy --env production
else
    wrangler deploy
fi

cd ..

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Set up custom domain in Cloudflare Dashboard:"
echo "   - Go to Workers & Pages > inigma > Settings > Triggers"
echo "   - Add Custom Domain: inigma.idone.su"
echo ""
echo "2. Add DNS record for your domain:"
echo "   - CNAME inigma -> inigma.workers.dev"
echo ""
echo "3. Test your deployment:"

if [ "$ENV" = "production" ]; then
    echo "   - https://inigma.idone.su"
else
    echo "   - https://inigma.workers.dev"
fi

echo ""
echo "🔍 View logs: wrangler tail --env $ENV"
