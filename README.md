<div align="center">

# 🌍 PivotMyTrip

**Plan Less. Experience More.**

AI-powered travel itineraries that adapt in real time — no more overplanning or last-minute chaos.

[![Watch Demo](https://img.shields.io/badge/▶_Watch_Demo-C85A2A?style=for-the-badge)](YOUR_DEMO_LINK_HERE)

![PivotMyTrip Landing](docs/screenshot.png)

</div>

---

## What It Does

- **AI Itinerary Generation** — Multi-day trip plans built by Groq LLM in seconds
- **Live Simulation** — Watch your journey play out on an interactive map
- **Mid-Trip Pivoting** — Add or swap stops while travelling; the route updates instantly
- **Auto Check-In** — Proximity-based check-ins as you move through each stop
- **Smart Replan** — Reoptimise remaining stops from your current location

---

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI, Pydantic, Python 3.11+ |
| AI | Groq LLM (primary), Ollama (fallback) |
| Routing & Geo | OSRM, Valhalla, Nominatim |

---

## Quick Start

### 1. Clone & install

```bash
# Backend
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend
cd client && npm install
```

### 2. Set environment variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_key_here
OSRM_BASE_URL=https://router.project-osrm.org
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
HOST=0.0.0.0
PORT=8000
```

### 3. Run

```bash
python run.py          # starts both backend and frontend
```

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Project Structure

```
PivotMyTrip/
├── backend/
│   ├── main.py          # FastAPI entrypoint
│   ├── routers/         # API routes (itinerary, tracking, voice)
│   ├── services/        # LLM, geocoding, routing logic
│   └── models/          # Pydantic schemas
├── client/
│   └── src/
│       ├── pages/       # Landing, Planning, Itinerary views
│       ├── components/  # Map, panels, status bar
│       ├── contexts/    # Global state (NomadContext)
│       └── lib/         # Simulation engine, API helpers
├── data/cache/          # Cached itineraries & routes
└── run.py               # One-command launcher
```

---

## License

MIT
