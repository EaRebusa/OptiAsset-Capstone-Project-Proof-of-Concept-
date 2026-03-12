# 📊 OptiAsset: A Data-Driven Equipment Health Scoring System

OptiAsset is an enterprise-grade decision-support tool designed for Business Technology Management (BTM). It leverages Unsupervised Machine Learning (K-Means Clustering) to diagnose the health of IT hardware fleets without the need for historical failure labels.

## 🚀 Key Features

* Unsupervised Diagnostic Engine: Categorizes assets into Healthy, Warning, and Critical clusters using multi-dimensional thermal and usage telemetry.

* Living Inventory: Implements auto-aging logic to calculate effective age and monitors data freshness (30+ day stale data warnings).

* Manager Override: A "Human-in-the-loop" feature allowing manual status corrections with mandatory justification logs for audit trails.

* Financial Risk Analytics: Real-time calculation of "Capital at Risk" based on the replacement cost of 'Critical' and 'Warning' units.

* Specs Library: A vendor-agnostic "Ground Truth" management system for hardware baselines (Laptops and Desktops).

## 🛠️ Tech Stack

### Component

#### Technology

##### Backend

* FastAPI (Python), SQLAlchemy, Scikit-Learn, Pandas

##### Database

* SQLite (Persistent local storage)

##### Frontend

* React (Vite), Tailwind CSS, Recharts, Lucide-Icons

##### ML Model

* K-Means Clustering (Validated Silhouette Score: ~0.55)

## 📂 Project Structure

optiasset/
├── backend/
│   ├── app/                # FastAPI Application logic (MVC)
│   ├── data/               # SQLite DB and ML .pkl artifacts
│   └── scripts/            # Data generation & Pipeline utilities
└── frontend/               # React + Vite Application


## 🏃‍♂️ Running the System (Demo Sequence)

To showcase the system from a clean state to a fully populated dashboard, follow this sequence:

* Initialize: Run the cold_start.bat file in the root directory.

* Hard Reset: Navigate to backend/scripts and run:

#### python hard_reset.py

(This wipes the DB and re-runs the full pipeline: Gen -> Onboard -> Train -> Diagnose).

* Launch Backend: Run the start_backend.bat file.

* Launch Frontend:

cd frontend
npm run dev


Access the dashboard at http://localhost:5173.

## 🧠 Machine Learning Logic (For Academic Review)

Unlike standard RMM tools that use "Hard Thresholds" (e.g., alert if Temp > 80°C), OptiAsset uses Unsupervised Clustering. The system analyzes the relationship between:

* Age vs. Temperature: Detecting thermal degradation relative to the model's norm.

* Usage vs. Repairs: Identifying stress-induced failure probability.

* Maintenance Quality: Factoring in the human upkeep score (1-10).

By clustering the data into 3 groups, the system identifies units that are "deviating from the norm" for their specific hardware model, even if they haven't hit a hard failure limit yet.

## 🤝 Contributors

#### Rebusa, Estabillo, Pacatang - University of Southeastern Philippines (USeP) - Davao

### BTM Framework Implementation - 2026
