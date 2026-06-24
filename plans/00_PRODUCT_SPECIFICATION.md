# MovMin MVP Specification

## AI-Powered Provincial Mobility Intelligence Platform

---

# 1. Problem Statement

Provincial transportation operators, commuters, and local governments often lack visibility into route performance, travel disruptions, passenger demand trends, and infrastructure planning opportunities. Existing systems are reactive rather than predictive, leading to delays, congestion, and inefficient resource allocation.

**MovMin** provides a centralized mobility intelligence platform that enables stakeholders to monitor transportation corridors, predict disruptions, simulate operational scenarios, and make data-driven decisions.

---

# 2. MVP Goal

Build a functional prototype that demonstrates how AI and mobility analytics can improve provincial transportation management.

### Project Scope

* **Target Demo Duration:** 5–7 Minutes
* **Development Time:** 48 Hours
* **Data Source:** Simulated + Public Data
* **Deployment:** AWS Cloud

---

# 3. User Personas

## Passenger

### Needs

* Know expected arrival times
* Be informed of route disruptions
* Receive travel recommendations

---

## Transport Operator

### Needs

* Monitor active routes
* Identify delays and bottlenecks
* Plan fleet deployment

---

## LGU / Transport Planner

### Needs

* Understand mobility patterns
* Identify underserved areas
* Evaluate infrastructure decisions

---

# 4. Core MVP Features

---

## 4.1 Real-Time Corridor Monitoring

### Purpose

Provide a live operational view of intercity and provincial transportation routes.

### User Story

> As a transport operator, I want to see active buses and route conditions so I can monitor operations.

### Data Requirements

#### Simulated Data

* Bus GPS coordinates
* Route locations
* Terminal locations
* Congestion levels
* Vehicle speeds

### UI Components

#### Interactive Map

Displays:

* Active buses
* Route paths
* Bus terminals
* Incident markers

#### Route Status Panel

Example:

```text
Davao → Tagum

12 Active Buses
Average Speed: 38 km/h
Status: Moderate Traffic
```

### Outputs

* Live bus positions
* Route congestion status
* Traffic indicators

---

## 4.2 Smart ETA Prediction

### Purpose

Estimate travel times using route conditions.

### User Story

> As a passenger, I want to know my estimated arrival time.

### Inputs

* Route distance
* Traffic level
* Weather condition
* Road incidents

### ETA Logic

```text
ETA =
Base Travel Time
+ Traffic Delay
+ Weather Delay
+ Incident Delay
```

### Example Output

```text
Estimated Arrival:
2 hrs 15 mins

Delay:
+20 mins due to heavy rainfall
```

---

## 4.3 Incident Intelligence Feed

### Purpose

Provide situational awareness across transportation corridors.

### User Story

> As an operator, I want to know incidents affecting transportation routes.

### Data Sources

#### Public / Simulated

* PAGASA weather alerts
* Flood warnings
* Landslide reports
* Road closure notices
* Disaster advisories

### UI Component

#### Incident Feed Panel

Example:

```text
Flood Warning
Marilog District

Potential Delays:
15–30 mins
```

### Outputs

* Incident alerts
* Affected routes
* Estimated delays

---

## 4.4 AI Demand Intelligence

### Purpose

Forecast passenger demand.

### User Story

> As an operator, I want to anticipate demand spikes.

### Data Requirements

#### Simulated

* Historical passenger counts
* Holidays
* School calendars
* Festivals
* Weather conditions

### Visualization

#### Demand Forecast Chart

Example:

```text
Current Demand:
1,500 passengers

Forecast:
+28% this weekend
```

### AI Insight Example

```text
Expected demand increase due to
Kadayawan Festival activities.
```

### Outputs

* Demand forecasts
* Passenger growth projections
* AI-generated demand insights

---

## 4.5 Route Analytics Dashboard

### Purpose

Provide route performance metrics.

### User Story

> As an operator, I want to understand route efficiency.

### Metrics

* Average travel time
* Delay frequency
* On-time performance
* Route utilization

### Dashboard Cards

```text
Average Delay
12 mins

On-Time Rate
89%

Utilization
74%
```

### Visualizations

* Line Charts
* Bar Charts
* Trend Analysis

### Outputs

* Route performance metrics
* Historical route insights

---

## 4.6 What-If Scenario Simulator

### Purpose

Evaluate operational decisions before implementation.

### User Story

> As a planner, I want to understand the impact of disruptions.

### Scenario Inputs

#### Route Closure

```text
Close:
Davao–Bukidnon Highway
```

#### Demand Increase

```text
Passenger Growth:
+30%
```

### Simulation Outputs

```text
Travel Time Increase:
+25 mins

Congestion Increase:
+18%

Recommended Alternative:
Route B
```

### AI Recommendation

```text
Deploy 2 additional buses
to maintain service levels.
```

### Outputs

* Scenario impact assessment
* Route alternatives
* Resource recommendations

---

## 4.7 Provincial Mobility Heatmap

### Purpose

Visualize mobility demand across provinces and municipalities.

### User Story

> As an LGU planner, I want to identify high-demand corridors.

### Data Requirements

#### Simulated

* Population data
* Passenger demand
* Route activity

### Visualization

#### Heatmap Overlay

Example:

```text
High Demand Corridors

Davao City → Tagum
Davao City → Digos
```

### Planning Insight Example

```text
Potential terminal location:
Panabo City
```

### Outputs

* Demand hotspots
* Corridor analysis
* Terminal location recommendations

---

# 5. AI Components

## 5.1 AI Insight Generator

### AWS Bedrock

#### Input

```json
{
  "route": "Davao-Tagum",
  "delay": 25,
  "demand_growth": 30
}
```

#### Output

```text
Demand is expected to exceed available capacity this weekend.
Consider deploying additional units.
```

---

## 5.2 AI Scenario Analysis

### Input

```text
Road Closure:
Marilog
```

### Output

```text
Estimated Delay:
35 minutes

Suggested Reroute:
Buda Corridor
```

---

# 6. Technical Architecture

## Frontend

### Framework

* React
* Vite
* TypeScript

### UI Framework

* Tailwind CSS
* shadcn/ui

### Data Visualization

* MapLibre GL
* Recharts

---

## Backend

### API Framework

* FastAPI

### Services

* Route Simulation Engine
* ETA Computation Engine
* Incident Management Service
* Scenario Analysis Engine

---

## Database

### PostgreSQL (Amazon RDS)

#### Tables

```text
routes
buses
incidents
terminals
analytics
forecasts
```

---

# 7. AWS Services

## Required Services

### Amazon Bedrock

* AI insights
* Scenario recommendations

### AWS Lambda

* Simulated data generation
* Scheduled route updates

### Amazon RDS

* PostgreSQL database

### AWS Amplify

* Frontend deployment
* CI/CD

---

# 8. Simulated Dataset

## Routes

```text
Davao → Tagum
Davao → Panabo
Davao → Digos
Davao → Mati
Davao → Kidapawan
```

---

## Bus Fleet

```text
50 Simulated Buses
```

### Bus Attributes

```text
id
route
latitude
longitude
speed
occupancy
status
```

### Status Values

```text
Active
Delayed
Stopped
Maintenance
```

---

# 9. Success Criteria

The MVP is successful if judges can:

* View live route operations
* See moving buses on an interactive map
* Receive ETA predictions
* View incidents affecting routes
* Generate AI mobility insights
* Simulate transportation disruptions
* Visualize transportation demand patterns

---

# 10. Demo Flow

## Step 1: Corridor Monitoring

Display live bus movement on the map.

## Step 2: Incident Alert

Trigger a simulated flood or road closure.

## Step 3: ETA Prediction

Show ETA updates caused by the incident.

## Step 4: Demand Forecast

Display projected passenger demand increases.

## Step 5: Scenario Simulation

Simulate closure of a major transportation corridor.

## Step 6: AI Recommendation

Generate mitigation strategies using Amazon Bedrock.

## Step 7: Mobility Heatmap

Highlight demand hotspots and future terminal opportunities.

---

# 11. Vision Statement

> **MovMin transforms provincial transportation from reactive operations into predictive mobility intelligence, empowering operators, passengers, and governments to make smarter transportation decisions.**

