from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlmodel import Session
from app.core.database import engine # Use the main engine
from app.services import secret_service as crud_secrets
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

def delete_expired_secrets_job():
    logger.info("Running scheduled job: delete_expired_secrets_job")
    try:
        with Session(engine) as session:
            deleted_count = crud_secrets.delete_expired_secrets(db=session)
            if deleted_count > 0:
                logger.info(f"Successfully deleted {deleted_count} expired secrets.")
            else:
                logger.info("No expired secrets found to delete.")
    except Exception as e:
        logger.error(f"Error during scheduled deletion of expired secrets: {e}", exc_info=True)

def setup_scheduler():
    # Schedule the job to run (e.g., every hour)
    # For testing, you might use a shorter interval like every 1-5 minutes
    scheduler.add_job(
        delete_expired_secrets_job,
        trigger=IntervalTrigger(hours=1), # Or minutes=5 for testing
        id="delete_expired_secrets_job",
        name="Delete expired secrets regularly",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started and 'delete_expired_secrets_job' scheduled.")
