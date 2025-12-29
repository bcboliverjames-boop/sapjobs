Start:
  npm install
  npm start

Env:
  PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
  HOST (default 127.0.0.1)
  PORT (default 3000)
  REGISTER_BONUS_POINTS (default 10)

Endpoints:
  GET  /health
  POST /profile/get_or_create
  GET  /profile
  POST /profile/update
  GET  /points
