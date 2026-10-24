# 🚀 AI CreatorHub — Full-Stack AI Content Creator Marketplace

A production-ready marketplace connecting brands/clients with AI-powered content creators.

---

## 📁 Project Structure

```
ai-creatorhub/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/      # API route handlers
│   │   ├── core/     # Config, DB, Security
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   └── services/ # Business logic
│   ├── .env          # Backend environment variables
│   ├── requirements.txt
│   ├── seed.py       # Database seed script
│   └── main.py
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── pages/   # All page components
│   │   ├── components/
│   │   ├── services/ # Axios API layer
│   │   └── store/    # Zustand state
│   ├── .env
│   └── vite.config.js
├── start-backend.ps1  # Backend startup script
├── start-frontend.ps1 # Frontend startup script
└── seed-database.ps1  # Database seed script
```

---

## ⚡ Quick Start

### Step 1: Setup Backend

```powershell
cd backend

# Install dependencies
py -m pip install -r requirements.txt

# The .env file is already configured with SQLite for local development
# Edit backend/.env to configure your settings

# Seed demo data
py seed.py

# Start backend server
py -m uvicorn app.main:app --reload --port 8000
```

### Step 2: Setup Frontend

```powershell
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Step 3: Access the App

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 🔑 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aicreatorhub.com | Admin@1234 |
| Client | aisha@example.com | Client@123 |
| Creator | priya@example.com | Creator@123 |

> Use the **Quick Demo Login** buttons on the Login page for one-click access.

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** — Modern Python web framework
- **SQLAlchemy** — ORM (supports SQLite & PostgreSQL)
- **JWT Auth** — Secure authentication with python-jose
- **bcrypt** — Password hashing with passlib
- **WebSockets** — Real-time chat
- **SQLite** (dev) / **PostgreSQL** (production)

### Frontend
- **React 18 + Vite** — Fast, modern UI
- **Tailwind CSS v4** — Utility-first styling
- **Framer Motion** — Smooth animations
- **Zustand** — Lightweight global state
- **Axios** — HTTP client with interceptors
- **Recharts** — Dashboard charts
- **React Router v6** — Client-side routing
- **React Hot Toast** — Notification system

---

## 🎯 Features

### 👥 User Roles
- **Guest** — Browse creators and public pages
- **Client** — Hire creators, manage orders, chat, pay
- **AI Creator** — Manage profile, portfolio, services, orders
- **Admin** — Full platform control

### 🏪 Marketplace
- Creator discovery with filters (category, price, rating, verified)
- Detailed creator profiles with portfolio lightbox
- Service packages with pricing

### 💬 Real-time Chat
- WebSocket-based messaging
- Conversation list with unread badges
- REST fallback for reliability

### 📦 Order Workflow
```
Client Places Order → Creator Accepts → In Progress →
Creator Delivers → Client Reviews/Approves → Completed
```
With: Revision requests, dispute system, simulated payments

### 🎬 Video Studio (creators)
- Manual media upload (video / image / audio) + asset library
- Timeline editing: trim, split, reorder
- Manual text overlays and captions
- Uploaded audio with volume controls
- Preview, autosave, undo/redo
- Browser-side export, then submit for admin review

> This platform does not provide AI generation features. Creators produce
> content with their own tools and upload the results.

### ⚙️ Admin Panel
- Dashboard with revenue charts
- User management (block/unblock/role change)
- Creator management (approve/reject/verify/feature)
- Order management with status override
- Creator assignment system
- Chat monitoring + message flagging
- Payment tracking
- Review moderation
- Dispute resolution

---

## 🔧 Environment Configuration

### Backend `.env`

```env
DATABASE_URL=sqlite:///./creatorhub.db  # SQLite (dev)
# DATABASE_URL=postgresql://user:pass@host:5432/db  # PostgreSQL (prod)

SECRET_KEY=your-super-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

ADMIN_EMAIL=admin@aicreatorhub.com
ADMIN_PASSWORD=Admin@1234
ADMIN_NAME=Platform Admin

PLATFORM_COMMISSION_PERCENT=20
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## 🚀 Production Deployment

### Backend
1. Set `DATABASE_URL` to a PostgreSQL connection string
2. Set a strong `SECRET_KEY`
3. Use `gunicorn` or Docker for production serving

### Frontend
```bash
npm run build
# Deploy the dist/ folder to Vercel/Netlify/etc.
```

---

## 📊 Database Models

| Model | Description |
|-------|-------------|
| User | Base user (client/creator/admin) |
| CreatorProfile | Extended creator info |
| Service | Creator service packages |
| PortfolioItem | Portfolio works |
| Order | Project orders |
| Assignment | Admin-assigned projects |
| Chat | Conversation threads |
| Message | Chat messages |
| Payment | Transaction records |
| Review | Creator ratings |
| Notification | In-app notifications |
| Dispute | Order disputes |
| SavedCreator | Client wishlist |

---

## 🎨 Design System

- **Colors**: Indigo/Purple gradient primary palette
- **Dark Mode**: Full system-wide dark theme
- **Animations**: Framer Motion page transitions, hover effects
- **Glassmorphism**: Cards and overlays
- **Fonts**: Inter + Plus Jakarta Sans

---

Built with ❤️
