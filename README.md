# StyleFusion AI — AI-Powered Fashion E-Commerce & Virtual Try-On

Full-stack fashion e-commerce platform featuring a minimalist black-and-white storefront, SQLite persistence, shopping bag, wishlist, multi-step checkout, order tracking, admin analytics dashboard, and live **Hugging Face AI Virtual Try-On** (`IDM-VTON`, `CatVTON`, `OOTDiffusion`, or custom HTTP inference endpoints).

---

## Project Architecture

- **Frontend (`/src`)**: React 19, Vite, Tailwind CSS v4, React Router DOM, Axios, Lucide React
- **Node/Express Live Runtime (`server.ts` & `server/`)**: Full-stack Express + SQLite (`backend/instance/fashion_store.db`) + `@gradio/client` server running on port `3000`
- **Python Flask Backend (`backend/`)**: Complete Flask REST API, SQLAlchemy ORM, Flask-JWT-Extended, Flask-CORS, Hugging Face Virtual Try-On adapter (`huggingface_service.py` & `virtual_tryon_service.py`), `seed.py`, and `pytest` suite sharing the exact same SQLite schema and `/api/*` contract.

---

## Seeded Accounts (SQLite)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@ateliervera.com` | `Admin@1234` |
| Customer | `claire@ateliervera.com` | `Customer@1234` |

---

## Windows PowerShell Setup Instructions

### 1. Backend (Python + Flask + SQLite)

```powershell
cd backend

python -m venv venv

.\venv\Scripts\Activate.ps1

pip install -r requirements.txt

Copy-Item .env.example .env

python seed.py

python run.py
```

The Flask API server starts at `http://localhost:5000` and automatically initializes `backend/instance/fashion_store.db`.

### 2. Frontend (React + Vite)

Open a second PowerShell terminal at the repository root:

```powershell
npm install

npm run dev
```

*(If running standalone Vite against Flask on port 5000, configure a `/api` proxy or run the integrated Express + Vite server with `npm run dev` on port `3000`.)*

---

## Environment & Hugging Face Configuration

Edit `.env` (or `backend/.env`):

```env
SECRET_KEY=change_this_secret
JWT_SECRET_KEY=change_this_jwt_secret

DATABASE_URL=sqlite:///fashion_store.db

# Optional Hugging Face Access Token (recommended for higher ZeroGPU priority or gated models)
HF_API_TOKEN=hf_your_token_here

# Hugging Face Space Model ID (supported adapters: yisol/IDM-VTON, zhengchong/CatVTON, levihsu/OOTDiffusion)
HF_MODEL_ID=yisol/IDM-VTON

# Optional: Set HF_API_URL to route inference to a dedicated Hugging Face Inference Endpoint or self-hosted GPU server
HF_API_URL=

UPLOAD_FOLDER=uploads
GENERATED_FOLDER=generated
```

### Model Setup & Limitations
- **Public ZeroGPU Spaces (`yisol/IDM-VTON`, `zhengchong/CatVTON`, `levihsu/OOTDiffusion`)**: Connected directly via `gradio_client` / `@gradio/client`. First request after inactivity may experience a cold-start queue (15–45s). Public Spaces enforce daily ZeroGPU IP/account quotas (`429`); setting `HF_API_TOKEN` increases quota or unlocks private/duplicated Spaces.
- **Dedicated / Self-Hosted Inference (`HF_API_URL`)**: For guaranteed SLA and zero queue delays in production, deploy `IDM-VTON` or `CatVTON` to a dedicated Hugging Face Inference Endpoint or GPU container and set `HF_API_URL` + `HF_API_TOKEN`.
- **Zero Fake Outputs**: If the upstream Hugging Face service returns an error, timeout, or quota limit, the backend records `status="failed"` with the exact `error_message` in SQLite and surfaces the error cleanly in the UI.

---

## Running Backend Tests (pytest)

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest -v
```

### Test Coverage
- User registration, login, and password verification
- Product catalog retrieval and search filtering
- Wishlist add/remove and persistent shopping cart calculations
- Multi-step checkout, order placement, and inventory stock decrement
- Admin role-based authorization (`403` for customers, `200` for admins) and product multipart image upload
- AI Virtual Try-On image resolution validation, Hugging Face inference execution, and error/rate-limit handling
