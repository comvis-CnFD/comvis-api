# ComVis API - AI Agent Instructions

## Project Overview

ComVis API is a Node.js/Express backend for a crowd and fatigue detection system. It manages user authentication, area monitoring, real-time crowd density analysis, and fatigue detection through MQTT/Socket.IO integration with external Python-based ML models.

**Key Stack**: Express.js, Prisma ORM, PostgreSQL, MQTT, Socket.IO, JWT auth

## Architecture

### Core Data Flow

1. **Client Connection** → Socket.IO for real-time frame transmission
2. **Frame Processing** → Frames published to MQTT broker (`mqtt-crowd-frame`, `mqtt-face-frame`)
3. **ML Analysis** → External Python services consume frames, analyze, publish results
4. **Result Reception** → Server receives results via MQTT topics (`mqtt-crowd-result`, `mqtt-fatigue-result`)
5. **Database Persistence** → Results stored via Prisma models, emitted back to clients

### Service Boundaries

**User & Auth** (`AuthController`, `UserModel`)

- Registration: uploads photos → creates user folder → triggers Python training script
- Photo storage: `src/public/user-photos/{userId}/`
- Password hashing: bcrypt with 10 rounds
- JWT tokens: Bearer format in `Authorization` header

**Area Management** (`AreaController`, `AreaModel`)

- Users own areas with capacity limits
- Areas have many crowds (1-to-many)
- Crowd status derived from: `count / capacity` → status (Kosong/Sepi/Sedang/Ramai/Penuh)

**Real-time Integration**

- Socket.IO listens for client frames (`io-crowd-frame`, `io-fatigue-frame`)
- MQTT Client subscribes to 3 result topics and receives JSON results
- Results trigger `insertCrowd()` / `insertFatigue()` with calculated status
- Results emitted back via Socket.IO to connected clients

## Key Patterns & Conventions

### Model Layer (`src/models/`)

- Pure data access functions, no business logic
- Always use Prisma `select` to exclude sensitive fields (passwords, security answers)
- Return flattened objects with nested data (e.g., `getCrowdByUserId` joins `area.user_id`)
- All models export named functions: `insert*`, `getAll*`, `get*ById`, `update*`, `delete*`

### Controller Layer (`src/controllers/`)

- Handle request validation, call models, format responses
- Wrap in try-catch, return error with `{ message: error.message }`
- Controllers match routes 1:1 (e.g., `AuthController.login`)

### Middleware (`src/middleware/`)

- `authenticateJWT`: Extracts token from `Authorization: Bearer <token>` header, decodes with `JWT_SECRET`, attaches `req.user`
- `checkAdmin`: Verifies `req.user.role === 'admin'` (must run after `authenticateJWT`)
- `uploadPhotosMiddleware`: Multer configuration in separate file, exports `upload` object

### Route Organization (`src/routes/index.js`)

- Auth routes: no middleware
- User/Admin routes: `authenticateJWT` + optional `checkAdmin`
- Resource routes follow RESTful pattern with user context (e.g., `/areas/users/:user_id`)

### Database (`src/config/db.js`)

- Single Prisma client instance exported for all models
- Schema: `users` → `areas` → `crowds`; `users` → `fatigues`
- Cascade deletes configured (deleting user cascades to areas/fatigues)
- Timestamps: `DateTime @db.Timestamp` stored in UTC

### Environment Variables (`.env`)

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Token signing key
- `MQTT_BROKER`: localhost (default)
- `MQTT_PORT`: 1883
- `PORT`: Server port (default 3000)
- `FACE_RECOGNITION_PATH`: Path to Python face-recognition module (defaults to `../../../crowd_fatigue_detection_web/face-recognition` if not set)

## Critical Workflows

### Running the Server

```bash
npm start  # Runs nodemon src/index.js with auto-reload
```

No build step; Node runs `.js` directly.

### Database Migrations

Uses Prisma. After schema changes:

```bash
npx prisma migrate dev --name <description>  # Creates migration, applies to dev db
npx prisma generate  # Regenerate Prisma client
```

### User Registration Flow

1. POST `/register` with `multipart/form-data`: `email`, `name`, `password`, `security_answer`, `photos[]`
2. Controller validates, hashes password, inserts user
3. Creates `src/public/user-photos/{userId}/` directory
4. Copies uploaded photos to that directory
5. Deletes `FACE_RECOGNITION_PATH/.../face_features/feature.npz` (forces retraining)
6. Spawns background Python process: `add_persons.py` via `FACE_RECOGNITION_PATH` (async, no wait)

### Real-time Crowd Detection

1. Client emits: `socket.emit('io-crowd-frame', base64Frame, capacity, area_id)`
2. Server receives, publishes to MQTT: `mqtt-crowd-frame` → base64 frame
3. Python service consumes, analyzes, publishes result: `mqtt-crowd-result` → `{ num_people: X }`
4. Server receives, calculates status from thresholds: 33% = "Sepi", 66% = "Sedang", etc. (thresholds are customizable via `src/index.js` status calculation logic)
5. `insertCrowd()` writes to DB
6. Server emits back: `socket.emit('receive-crowd', { count, status, ...})`

### JWT Authentication Pattern

- Extract token: `Authorization.split(' ')[1]`
- Verify: `jwt.verify(token, JWT_SECRET)`
- Payload structure: `{ id, email, role, ... }` → attached to `req.user`
- Token generation: `jwt.sign(userData, JWT_SECRET)`

## Common Modifications

### Adding a New Resource Type

1. Add model to `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name add_<resource>`
3. Create `src/models/<Resource>Model.js` with CRUD functions
4. Create `src/controllers/<Resource>Controller.js` with request handlers
5. Add routes to `src/routes/index.js`
6. Apply same JWT/admin checks as existing resources

### Integrating New MQTT Topic

1. Add subscription in `index.js`: `client.subscribe('mqtt-new-topic')`
2. Add handler in `client.on('message')` switch: `case 'mqtt-new-topic':`
3. Extract result, transform, insert via model, emit via Socket.IO
4. Update corresponding controller if exposing via REST API

### File Upload Considerations

- Multer temp folder: `req.files[].path` (OS temp dir)
- Must manually rename to permanent location (see `AuthController.register`)
- Error handling: clean up temp files in catch block

## Anti-Patterns Observed (Avoid)

- ❌ Storing passwords without hashing
- ❌ Validating JWT without `JWT_SECRET` env var check
- ❌ Blocking operations in Socket.IO handlers (use async/await)
- ❌ Hardcoding paths; use relative paths or env vars
- ❌ Forgetting cascade on Prisma relations (data orphaning)

## Debugging Tips

- Check `.env` loaded: add `console.log(process.env.DATABASE_URL)` early in `index.js`
- MQTT connection issues: verify broker running on `localhost:1883`
- Prisma query errors: check `select` excludes invalid fields; use `prisma.users.findUnique(...)`
- Socket.IO events: server logs client ID on connect; verify client emits correct event name
- Python integration: check `dirFaceRecognition` path relative to controller file location
