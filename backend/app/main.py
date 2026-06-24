import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base, SessionLocal
from app.core.logging import setup_logging
from app.api.routes import router as routes_router
from app.api.buses import router as buses_router
from app.api.terminals import router as terminals_router
from app.api.corridors import router as corridors_router
from app.simulation.seed import seed_database
from app.simulation.engine import simulation_engine, websocket_manager

logger = logging.getLogger(__name__)

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created / verified")
        
        # Seed routes and terminals
        with SessionLocal() as db:
            seed_database(db)
            
        # Initialize and start simulation engine
        with SessionLocal() as db:
            simulation_engine.initialize_buses(db)
        await simulation_engine.start()
    except Exception as e:
        logger.warning("Database or simulation not available yet: %s", e, exc_info=True)
        
    yield
    
    # Shutdown simulation engine on exit
    await simulation_engine.stop()


app = FastAPI(title="Movmin API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(routes_router, prefix="/api")
app.include_router(buses_router, prefix="/api")
app.include_router(terminals_router, prefix="/api")
app.include_router(corridors_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/buses")
async def websocket_buses(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Maintain connection, listen for messages (e.g. heartbeat)
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket client error: {e}")
        websocket_manager.disconnect(websocket)

