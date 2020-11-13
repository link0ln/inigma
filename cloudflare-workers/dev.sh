#!/bin/bash

# Development utilities for Inigma Cloudflare Workers

case "$1" in
  "logs")
    echo "📋 Showing live logs for production environment..."
    wrangler tail --env production
    ;;
  "dev-logs")
    echo "📋 Showing live logs for development environment..."
    wrangler tail
    ;;
  "r2-list")
    echo "📁 Listing objects in R2 bucket..."
    wrangler r2 object list inigma-storage
    ;;
  "r2-cleanup")
    echo "🧹 Manual cleanup of expired messages..."
    # This would require a script to iterate through objects
    echo "Use the web dashboard or implement a cleanup script"
    ;;
  "test")
    echo "🧪 Testing the worker locally..."
    npm run build
    cd build && wrangler dev --local
    ;;
  "status")
    echo "📊 Checking deployment status..."
    wrangler status
    ;;
  *)
    echo "🛠️  Inigma Development Utilities"
    echo ""
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  logs        - Show live production logs"
    echo "  dev-logs    - Show live development logs"
    echo "  r2-list     - List objects in R2 bucket"
    echo "  r2-cleanup  - Manual cleanup of expired messages"
    echo "  test        - Test worker locally"
    echo "  status      - Check deployment status"
    ;;
esac
