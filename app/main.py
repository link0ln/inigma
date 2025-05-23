import logging # Added for basic logging config
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse 

from app.api.endpoints import router as secrets_router 
from app.core.database import create_db_and_tables 
from app.core.scheduler import setup_scheduler, scheduler # Added scheduler imports

# Basic logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__) # For main.py's own logs

app = FastAPI(title="Inigma Next")

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Setup Jinja2 templates
templates = Jinja2Templates(directory="app/templates")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    setup_scheduler() # Start the scheduler and job

@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down scheduler...")
    scheduler.shutdown()
    logger.info("Scheduler shut down.")

# Include the secrets router with the new prefix and tags
app.include_router(
    secrets_router, 
    prefix="/api/v1/secrets", 
    tags=["Secrets"]
)

@app.get("/", response_class=HTMLResponse) 
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/s/{secret_id}", response_class=HTMLResponse)
async def view_secret_page(request: Request, secret_id: str):
    # This just serves the page; actual data fetching will be via JS API call.
    return templates.TemplateResponse("view.html", {"request": request, "secret_id": secret_id})
