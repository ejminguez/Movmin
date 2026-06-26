import logging
from app.core.database import SessionLocal
from app.models.routes import Route
from app.models.terminals import Terminal
from app.models.buses import Bus
from app.models.incidents import Incident
from app.models.analytics import Analytic
from app.models.forecasts import Forecast
from app.models.scenario_log import ScenarioLog
from app.simulation.seed import seed_database
from app.simulation.engine import simulation_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reseed")

def reseed():
    db = SessionLocal()
    try:
        logger.info("Cleaning up existing simulation data...")
        # Deleting in reverse order of foreign key dependencies to avoid constraint violations
        db.query(ScenarioLog).delete()
        db.query(Forecast).delete()
        db.query(Analytic).delete()
        db.query(Incident).delete()
        db.query(Bus).delete()
        db.query(Terminal).delete()
        db.query(Route).delete()
        db.commit()
        logger.info("Data cleanup complete.")

        logger.info("Seeding new routes and terminals...")
        seed_database(db)

        logger.info("Initializing buses...")
        simulation_engine.initialize_buses(db)
        
        logger.info("Reseed complete!")
    except Exception as e:
        logger.error(f"Error during reseed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reseed()
