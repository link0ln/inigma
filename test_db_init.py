import os
from sqlmodel import SQLModel, Session, create_engine

# Ensure this import works and Secret model is defined
from app.models.secret import Secret # This line is crucial
from app.core.config import settings # Use the configured URL. Changed from DATABASE_URL directly to settings.DATABASE_URL

print(f"Current working directory: {os.getcwd()}")
print(f"Using Database URL: {settings.DATABASE_URL}") # Changed to settings.DATABASE_URL

# Expect DATABASE_URL to be like "sqlite:///./inigma_next.db"
# which means the db file should be in the CWD.
db_file_path = settings.DATABASE_URL.replace("sqlite:///", "") # Changed to settings.DATABASE_URL
print(f"Expected DB file path: {os.path.join(os.getcwd(), db_file_path)}")


engine = create_engine(settings.DATABASE_URL, echo=True) # Changed to settings.DATABASE_URL

def create_db_and_tables_directly():
    print("Attempting to create database and tables...")
    try:
        # SQLModel.metadata.create_all(engine) should create tables
        # defined in imported models (e.g., Secret)
        SQLModel.metadata.create_all(engine)
        print("SQLModel.metadata.create_all(engine) executed.")

        # Verify table creation directly with SQLAlchemy's inspector
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"Tables found by inspector: {tables}")
        if "secret" in tables:
            print("SUCCESS: 'secret' table found by inspector.")
        else:
            print("FAILURE: 'secret' table NOT found by inspector.")

    except Exception as e:
        print(f"Error during create_db_and_tables_directly: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure the current directory for the script is /app
    # The worker environment usually runs commands from the repo root.
    # If so, adjust paths or instruct worker to cd /app first.
    # For now, assume this script is run from /app
    # if os.getcwd() != "/app": # Commenting this out as bash session ensures we are in /app
    #     print("Warning: This script is intended to be run from the /app directory for correct relative pathing of the db file.")
    #     # Attempt to change to /app if possible, or adjust db_file_path logic
    #     # For now, we'll proceed and see the output.

    create_db_and_tables_directly()
