# GreenScore Marketplace - Quick Deployment Guide

## 🚀 Deploy to Railway (Recommended - Free & Easy)

1. **Visit**: https://railway.app
2. **Sign up** with GitHub
3. **Click "Deploy from GitHub repo"**
4. **Connect your repository**
5. **Deploy** - Railway will automatically detect Node.js and deploy

## 🚀 Deploy to Render (Alternative)

1. **Visit**: https://render.com
2. **Sign up** with GitHub
3. **Click "New +" → "Web Service"**
4. **Connect your repository**
5. **Use these settings**:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

## 🚀 Deploy to Heroku

1. **Install Heroku CLI**
2. **Run commands**:
   ```bash
   heroku create your-app-name
   git add .
   git commit -m "Deploy GreenScore"
   git push heroku main
   ```

## 📋 Pre-deployment Checklist

- ✅ Procfile created
- ✅ Package.json configured
- ✅ Environment variables handled
- ✅ Database will auto-create on first run
- ✅ File uploads configured for cloud storage

## 🔧 Environment Variables (Optional)

- `PORT` - Automatically set by hosting platforms
- `NODE_ENV` - Set to "production" for better performance

## 📝 Notes

- Database will be created automatically on first startup
- File uploads will work with temporary storage
- For production, consider upgrading to persistent storage
- The app includes all necessary dependencies
