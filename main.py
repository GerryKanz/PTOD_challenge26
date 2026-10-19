import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

ODPT_URL = "https://api-challenge.odpt.org/api/v4"
KEY = os.getenv("ODPT_CONSUMER_KEY")

app = FastAPI()


async def odpt(data_type: str, **filters):
    params = {"acl:consumerKey": KEY, **filters}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{ODPT_URL}/{data_type}", params=params)
        r.raise_for_status()
        return r.json()


# Station list (names per line)
@app.get("/stations")
async def stations(operator: str = "odpt.Operator:TokyoMetro"):
    return await odpt("odpt:Station", **{"odpt:operator": operator})


# Daily passenger counts per station (for congestion later)
@app.get("/passengers")
async def passengers(operator: str = "odpt.Operator:JR-East"):
    return await odpt("odpt:PassengerSurvey", **{"odpt:operator": operator})


# Live delay / suspension info per line (real-time signal for congestion)
@app.get("/train-info")
async def train_info():
    return await odpt("odpt:TrainInformation")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
