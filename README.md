# 🍞 DoughTime — Smart Malaysian Financial Tracker

> A modern, delightful expense tracking & financial companion tailored for Malaysian e-wallets, banks, and daily spending with AI-powered receipt scanning.

---

## ✨ Features

- **🇲🇾 Malaysian E-Wallet & Bank Support**: Pre-configured accounts for Touch 'n Go eWallet, MAE, GrabPay, Boost, Maybank, CIMB, GXBank, AEON Bank, Public Bank, Cash, and more.
- **🧾 AI Receipt & QR OCR**: Snap or upload transaction receipts and e-wallet screenshots to automatically extract amount, merchant, date, and category.
- **📊 Interactive Charts & Analytics**: Real-time spending breakdown by category (*Makan, Groceries, Petrol, Tolls, Subscriptions, etc.*).
- **💡 AI Spending Insights**: Personalized financial analysis, budget alerts, and Malaysian-tailored saving tips powered by LLM.
- **📱 Multi-Platform & PWA**: Runs seamlessly on Web (Mobile & Desktop), iOS, and Android via Expo and Progressive Web App (Add to Home Screen).
- **🔒 Local-First Privacy**: Transaction histories and budgets stored securely on your device.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React Native](https://reactnative.dev/) / [Expo](https://expo.dev/) (SDK 54) + [Expo Router](https://docs.expo.dev/router/introduction/)
- **Web Engine**: [React Native Web](https://necolas.github.io/react-native-web/) + Metro Bundler
- **Language**: TypeScript
- **State & Storage**: AsyncStorage (Local-first persistence)
- **Deployment**: [Vercel](https://vercel.com) (PWA Web)

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **Server**: Uvicorn ASGI
- **AI & OCR**: Gemini LLM (Vision & Structured JSON extraction)
- **Deployment**: [Render](https://render.com)

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: v18+ (tested on v24)
- **Python**: 3.10+
- **Package Managers**: `npm` and `pip`

---

### 1. Clone the Repository
```bash
git clone https://github.com/mlkyiing/dough-time.git
cd dough-time
```

---

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API key
echo "EMERGENT_LLM_KEY=your_api_key_here" > .env

# Start FastAPI server (runs on http://localhost:8000)
uvicorn server:app --reload --port 8000
```

---

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Start Expo development server
npm run web      # Open in Web Browser
# or
npm run start    # Open in Expo Go (Mobile)
```

---

## 🌐 Cloud Deployment Guide

### Frontend on Vercel
1. Import repository on [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set Environment Variable:
   - `EXPO_PUBLIC_BACKEND_URL`: `https://dough-time.onrender.com` (your deployed backend URL)
4. Click **Deploy**.

### Backend on Render
1. Create a **Web Service** on [Render](https://render.com) connected to this repo.
2. Configuration:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Environment Variable**: `EMERGENT_LLM_KEY` = `your_key`
3. Deploy!

---

## 📱 Installing on Your Phone (PWA)

No App Store required:
1. Open your live Vercel URL in **Safari (iOS)** or **Chrome (Android)**.
2. **iOS**: Tap **Share** $\rightarrow$ **Add to Home Screen**.
3. **Android**: Tap **⋮ (Menu)** $\rightarrow$ **Install App** / **Add to Home Screen**.
4. Launch DoughTime directly from your home screen full-screen!

---

## 📄 License
MIT License. Created with ❤️ for Malaysian spenders.
