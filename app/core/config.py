from pydantic_settings import BaseSettings # Changed import

class Settings(BaseSettings):
    APP_NAME: str = "Inigma Next"
    DATABASE_URL: str = "sqlite:///./inigma_next.db" # Ensure this matches your intended DB name
    # Add other settings here as needed

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8' # Optional: specify encoding

settings = Settings()
