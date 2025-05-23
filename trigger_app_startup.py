print("Attempting to trigger FastAPI app startup event for DB creation...")
try:
    from app.main import on_startup
    print("Imported on_startup from app.main")
    on_startup()
    print("Executed on_startup()")
    print("SUCCESS: FastAPI app startup event triggered for DB creation.")
except Exception as e:
    print(f"Error during app startup trigger: {e}")
    import traceback
    traceback.print_exc()
