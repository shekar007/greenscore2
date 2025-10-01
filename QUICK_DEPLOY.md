# 🚀 Quick Deploy Instructions

## Method 1: Railway (Easiest - No GitHub needed)

1. Go to https://railway.app
2. Click "Deploy from GitHub repo"
3. Choose "Deploy from local folder" 
4. Upload your `greenscore` folder
5. Railway will auto-deploy!

## Method 2: GitHub + Railway (Best for sharing)

### Step 1: Push to GitHub
```bash
# Create new repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/greenscore.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to https://railway.app
2. Click "Deploy from GitHub repo"
3. Select your greenscore repository
4. Click Deploy!

## Method 3: Render
1. Go to https://render.com
2. New Web Service
3. Connect GitHub repo
4. Deploy!

## 📝 What's Included
- ✅ Procfile for deployment
- ✅ Package.json with proper engines
- ✅ Railway.json configuration
- ✅ Render.yaml configuration
- ✅ All dependencies listed
- ✅ Database auto-creates on startup

## 🎯 After Deployment
Your app will be available at:
- Railway: `https://your-app-name.railway.app`
- Render: `https://your-app-name.onrender.com`

The database will be created automatically when the app starts!
