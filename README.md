# Low-burden Mode Accessibility

An entry for the PTOD (Open Data Challenge for Public Transportation in Tokyo)
2026 challenge. The app helps people who need, or prefer, a low-effort route
through Tokyo's train stations: wheelchair users, people with strollers or
luggage, older travellers, and anyone who wants to avoid crowds.

## Goals

1. **Station facility info:** show where a station's elevators, escalators,
   slopes and step-free paths are.
2. **Real-time congestion:** highlight the busy areas of a station right now,
   and point users to quieter, open spaces in the station.

## Datasets

All data comes from the ODPT API (`https://api-challenge.odpt.org/api/v4`).

| Need                   | ODPT data type          | Status      |
| ---------------------- | ----------------------- | ----------- |
| Station-level detail   | `odpt:Station`          | Wired up (`/stations`) |
| Accessibility          | `odpt:StationFacility`  | Planned     |
| Congestion (baseline)  | `odpt:PassengerSurvey`  | Wired up (`/passengers`) |
| Congestion (real-time) | `odpt:TrainInformation` | Wired up (`/train-info`) |

`odpt:StationFacility` holds barrier-free details per station (elevators,
escalators, slopes, accessible toilets and similar). Check the
[ODPT API specification](https://developer.odpt.org/) for which operators
publish it and which fields they fill in.

## Tech stack

| Layer    | Choice                                     |
| -------- | ------------------------------------------ |
| Backend  | Python with FastAPI, calling the ODPT API  |
| Frontend | React, as a website first                  |
| Later    | iOS app                                    |
| Editor   | VS Code                                    |

### Libraries

**Backend (Python):** in `requirements.txt`

- `fastapi`: web framework for the API
- `uvicorn`: server that runs the app
- `httpx`: async HTTP client for calling ODPT
- `python-dotenv`: loads the ODPT key from `.env`

**Frontend (React):** planned, not set up yet

- `vite`: project scaffolding and dev server
- `react` and `react-dom`
- A data-fetching helper such as `fetch` or `@tanstack/react-query`
- A map or floor-plan view for showing facilities and crowded areas
  (to be chosen)

## Roadmap

- [x] FastAPI backend with a shared ODPT client helper
- [x] Endpoints for stations, passenger surveys and live train information
- [ ] `/facilities` endpoint for `odpt:StationFacility`
- [ ] Combine station, facility and congestion data per station
- [ ] Set up the React website (Vite) and connect it to the backend
- [ ] Station view: list of elevators, escalators, slopes and step-free paths
- [ ] Congestion view: highlight crowded areas and suggest open spaces
- [ ] Port to an iOS app

## Getting started

### Requirements

- Python 3.10+
- An ODPT Challenge consumer key (register at the challenge site to get one)
- VS Code (recommended), with the Python extension

### Backend setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the project root with your key:

```env
ODPT_CONSUMER_KEY=your_consumer_key_here
```

`.env` is git-ignored, so the key stays out of version control.

### Running the backend

```bash
python main.py
```

or

```bash
uvicorn main:app --reload
```

The server starts at <http://127.0.0.1:8000>. Interactive API docs are available
at <http://127.0.0.1:8000/docs>.

### Frontend setup (planned)

Once the React app is added, it will be created with Vite in a `frontend/`
folder:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm run dev
```

## API endpoints

| Method | Path          | Query params                                    | ODPT data type          | Description                                        |
| ------ | ------------- | ----------------------------------------------- | ----------------------- | -------------------------------------------------- |
| GET    | `/stations`   | `operator` (default `odpt.Operator:TokyoMetro`) | `odpt:Station`          | Stations for an operator, including names per line |
| GET    | `/passengers` | `operator` (default `odpt.Operator:JR-East`)    | `odpt:PassengerSurvey`  | Daily passenger counts per station                 |
| GET    | `/train-info` | none                                            | `odpt:TrainInformation` | Live delay and suspension information per line     |

### Examples

```bash
curl "http://127.0.0.1:8000/stations"
curl "http://127.0.0.1:8000/stations?operator=odpt.Operator:Toei"
curl "http://127.0.0.1:8000/passengers?operator=odpt.Operator:TokyoMetro"
curl "http://127.0.0.1:8000/train-info"
```

Responses are passed through unchanged from the ODPT API (JSON-LD). Upstream
errors are raised as HTTP errors; requests time out after 20 seconds.

### Adding endpoints

All endpoints go through the `odpt(data_type, **filters)` helper in `main.py`,
which adds the consumer key and forwards any filters as query parameters. For
example, the planned facilities endpoint could look like this:

```python
@app.get("/facilities")
async def facilities(operator: str = "odpt.Operator:TokyoMetro"):
    return await odpt("odpt:StationFacility", **{"odpt:operator": operator})
```

## Project structure

```
.
├── main.py           # FastAPI app and ODPT client helper
├── requirements.txt  # Python dependencies
├── .env              # Your ODPT consumer key (not committed)
└── frontend/         # React app (planned)
```
