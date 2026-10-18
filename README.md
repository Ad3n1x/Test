# AD3N1X Workflow Test Dashboard

A workflow reliability workspace for repeatable test suites, inspectable failures, run history, and reliability signals.

## Stack
- React + Vite + JavaScript
- Node.js + Express
- MongoDB + Mongoose
- Zod request validation
- Recharts analytics

## Structure
- `client/` — responsive dashboard UI
- `server/` — REST API and deterministic text-classification evaluator

## Local development
1. Install Node.js 20+.
2. `cd server && npm install && npm run dev`
3. In another terminal: `cd client && npm install && npm run dev`
4. Optional: set `MONGODB_URI` in `server/.env` to enable persistence.
5. Set `VITE_API_URL` in `client/.env` if the API is not at `http://localhost:5000`.

The dashboard offers an explicitly labelled local demo workspace when no API/database is configured. Demo runs persist in this browser only; they are not presented as server-persisted records.

## Deployment
- Vercel: set Root Directory to `client`, Framework Preset to Vite, and `VITE_API_URL` to the Render API URL.
- Render: Node web service; Build Command `cd server && npm install`; Start Command `cd server && npm start`. Configure `MONGODB_URI` and `CLIENT_ORIGIN` in Render environment variables for persistent production data and restricted CORS.

## Safety
The initial text classifier is a transparent baseline for exercising the test runner, not an AI model. The API never executes user-provided JavaScript or arbitrary code.
