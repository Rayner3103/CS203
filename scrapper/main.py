from typing import Union
from fastapi import FastAPI, HTTPException
import asyncio 
import traceback

import scrapper

app = FastAPI()
app.is_scrapping = False

@app.get("/status")
def status():
    return {
        "Health": "OK",
        "Scrapping": app.is_scrapping
    }

@app.get("/lock")
def lock():
    app.is_scrapping = True
    return "OK"

@app.get("/unlock")
def unlock():
    app.is_scrapping = False
    return "OK"

@app.get("/scrape")
async def scrape():
    if app.is_scrapping:
        raise HTTPException(status_code=400, detail="Server currently undergoing scrapping.")
    
    app.is_scrapping = True

    # Run the scraping process in the background
    asyncio.create_task(run_scraping())

    return {"message": "Scrapping started"}

async def run_scraping():
    try:
        await asyncio.to_thread(scrapper.main)  # Run the blocking function in a thread
    except Exception as e:
        print(f"Scraping task failed: {e}")
        traceback.print_exc()
    finally:
        app.is_scrapping = False