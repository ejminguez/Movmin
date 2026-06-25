import asyncio
import logging
import random
from datetime import datetime
from typing import Dict, List, Tuple
from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.routes import Route
from app.models.buses import Bus
from app.models.incidents import Incident
from app.simulation.coordinates import get_position_along_route

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                # Client might have disconnected without properly closing
                logger.debug(f"Failed to broadcast to connection: {e}")


# Global connection manager for buses WebSocket
websocket_manager = ConnectionManager()


class SimulationEngine:
    def __init__(self):
        self.bus_states: Dict[int, dict] = {}  # bus_id -> simulation state dict
        self.is_running = False
        self.tick_interval_seconds = 2.0
        self.task = None

    def initialize_buses(self, db: Session):
        """Ensure 50 buses exist in the database and load/initialize their simulation state."""
        routes = db.query(Route).all()
        if not routes:
            logger.warning("No routes found in database. Cannot initialize buses.")
            return

        buses = db.query(Bus).all()
        
        # If no buses exist in database, seed 50 buses
        if not buses:
            logger.info("Seeding 50 buses...")
            buses = []
            for i in range(1, 51):
                route = routes[i % len(routes)]
                wp = (route.waypoints or [])[0] if route.waypoints else (7.0736, 125.6131)
                bus = Bus(
                    name=f"Bus {i:02d}",
                    route_id=route.id,
                    license_plate=f"LKG-{1000 + i}",
                    capacity=50,
                    current_lat=wp[0] if isinstance(wp, (list, tuple)) else 7.0736,
                    current_lng=wp[1] if isinstance(wp, (list, tuple)) else 125.6131,
                    speed=0.0,
                    occupancy=random.randint(5, 30),
                    status="active"
                )
                db.add(bus)
            db.commit()
            buses = db.query(Bus).all()
            logger.info("50 buses seeded successfully.")

        # Initialize simulation states
        for bus in buses:
            route = db.query(Route).filter(Route.id == bus.route_id).first()
            waypoints = route.waypoints if route and route.waypoints else []
            if not waypoints:
                continue

            total_dist = route.distance_km or 10.0
            
            # Start at a random progress along the route
            start_dist = random.uniform(0, total_dist)
            direction = random.choice([True, False])
            
            self.bus_states[bus.id] = {
                "route_id": bus.route_id,
                "route_name": route.name,
                "direction": direction,  # True = forward (Davao -> Dest), False = backward
                "distance_km": start_dist,
                "pause_ticks": 0,
                "speed": random.uniform(40.0, 60.0),
                "occupancy": bus.occupancy or random.randint(10, 45),
                "status": bus.status or "active"
            }
            
            # Calculate initial positions
            pos, bearing = get_position_along_route(waypoints, start_dist)
            
            bus.current_lat = pos[0]
            bus.current_lng = pos[1]
            bus.speed = self.bus_states[bus.id]["speed"]
            bus.last_updated = datetime.now()
            
        db.commit()
        logger.info(f"Loaded and initialized simulation state for {len(self.bus_states)} buses.")

    async def start(self):
        """Start the simulation loop in the background."""
        if self.is_running:
            return
        
        self.is_running = True
        self.task = asyncio.create_task(self._loop())
        logger.info("Simulation engine started.")

    async def stop(self):
        """Stop the simulation loop."""
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Simulation engine stopped.")

    async def _loop(self):
        """Background tick loop."""
        while self.is_running:
            try:
                await asyncio.sleep(self.tick_interval_seconds)
                await self._tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in simulation loop: {e}", exc_info=True)

    async def _tick(self):
        """Advance the simulation by one tick."""
        db = SessionLocal()
        try:
            # 1. Update incidents simulation (expires old ones, spawns new ones)
            from app.simulation.incidents import update_incidents_simulation
            update_incidents_simulation(db)

            # 2. Load active incidents to calculate speed modifiers
            incidents = db.query(Incident).filter(Incident.status == "active").all()

            buses = db.query(Bus).all()
            broadcast_data = []

            for bus in buses:
                state = self.bus_states.get(bus.id)
                if not state:
                    continue

                route = db.query(Route).filter(Route.id == bus.route_id).first()
                waypoints = route.waypoints if route and route.waypoints else []
                if not waypoints:
                    continue

                total_dist = route.distance_km or 10.0

                # Handle terminal pause
                if state["pause_ticks"] > 0:
                    state["pause_ticks"] -= 1
                    state["speed"] = 0.0
                    if state["pause_ticks"] == 0:
                        # Resuming travel, randomize speed and occupancy for next trip
                        state["speed"] = random.uniform(40.0, 60.0)
                        state["occupancy"] = random.randint(10, bus.capacity)
                else:
                    # Determine speed multiplier and status based on incidents affecting this route
                    route_incidents = [inc for inc in incidents if inc.affected_route_id == bus.route_id]
                    
                    status = "NORMAL"
                    speed_multiplier = 1.0
                    
                    if route_incidents:
                        incident_types = {inc.incident_type for inc in route_incidents}
                        
                        if "Road Closure" in incident_types:
                            status = "STOPPED" if (bus.id % 2 == 0) else "REROUTING"
                        elif "Landslide" in incident_types:
                            status = "STOPPED" if (bus.id % 2 == 0) else "DELAYED"
                        elif "Flood Warning" in incident_types or "Weather Advisory" in incident_types:
                            status = "DELAYED"
                        else:
                            status = "DELAYED"
                        
                        severity_multipliers = {
                            "LOW": 0.9,
                            "MEDIUM": 0.8,
                            "HIGH": 0.6,
                            "CRITICAL": 0.3
                        }
                        for inc in route_incidents:
                            severity = inc.severity.upper() if inc.severity else "MEDIUM"
                            mult = severity_multipliers.get(severity, 1.0)
                            if mult < speed_multiplier:
                                speed_multiplier = mult
                                
                    # Base speed is randomized
                    base_speed = random.uniform(45.0, 60.0)
                    
                    if status == "STOPPED":
                        state["speed"] = 0.0
                    else:
                        state["speed"] = base_speed * speed_multiplier
                    
                    state["status"] = status

                    # Calculate new distance traveled
                    # distance = speed * time
                    # tick interval is in seconds, speed in km/h
                    hours_elapsed = self.tick_interval_seconds / 3600.0
                    distance_delta = state["speed"] * hours_elapsed

                    if state["direction"]:
                        state["distance_km"] += distance_delta
                        if state["distance_km"] >= total_dist:
                            state["distance_km"] = total_dist
                            state["direction"] = False
                            state["pause_ticks"] = 5  # Pause for 10 seconds (5 ticks)
                    else:
                        state["distance_km"] -= distance_delta
                        if state["distance_km"] <= 0:
                            state["distance_km"] = 0.0
                            state["direction"] = True
                            state["pause_ticks"] = 5  # Pause for 10 seconds (5 ticks)

                # Get coordinate and bearing
                pos, bearing = get_position_along_route(waypoints, state["distance_km"])
                
                # If going backwards, adjust bearing by 180 degrees
                if not state["direction"] and state["pause_ticks"] == 0:
                    bearing = (bearing + 180) % 360

                # Update Bus model in database
                bus.current_lat = pos[0]
                bus.current_lng = pos[1]
                bus.speed = round(state["speed"], 1)
                bus.occupancy = state["occupancy"]
                bus.status = state["status"]
                bus.last_updated = datetime.now()

                # Gather data to broadcast
                broadcast_data.append({
                    "id": bus.id,
                    "route_id": bus.route_id,
                    "name": bus.name,
                    "license_plate": bus.license_plate,
                    "capacity": bus.capacity,
                    "current_lat": bus.current_lat,
                    "current_lng": bus.current_lng,
                    "speed": bus.speed,
                    "occupancy": bus.occupancy,
                    "status": bus.status,
                    "bearing": round(bearing, 1),
                    "last_updated": bus.last_updated.isoformat()
                })

            db.commit()

            # Package active incidents for WebSocket broadcast
            incidents_data = []
            for inc in incidents:
                route = db.query(Route).filter(Route.id == inc.affected_route_id).first()
                affected_routes = [route.name] if route else []
                incidents_data.append({
                    "id": f"INC{inc.id:03d}",
                    "type": inc.incident_type,
                    "severity": inc.severity.upper() if inc.severity else "MEDIUM",
                    "title": inc.title or f"{inc.incident_type} on Route",
                    "description": inc.description,
                    "latitude": inc.lat or 0.0,
                    "longitude": inc.lng or 0.0,
                    "affected_routes": affected_routes,
                    "estimated_delay_minutes": inc.estimated_delay_min or 0,
                    "status": inc.status or "active",
                    "created_at": inc.created_at.isoformat() if inc.created_at else None,
                    "expires_at": inc.expires_at.isoformat() if inc.expires_at else None,
                })

            # Broadcast update over WebSockets
            await websocket_manager.broadcast({
                "type": "bus_update",
                "timestamp": datetime.now().isoformat(),
                "buses": broadcast_data,
                "incidents": incidents_data
            })

        except Exception as e:
            logger.error(f"Error in simulation tick: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()


# Global instance of simulation engine
simulation_engine = SimulationEngine()
