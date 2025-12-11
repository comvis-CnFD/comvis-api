# ComVis API

Backend untuk Crowd dan Fatigue Detection berbasis real-time menggunakan Socket.IO, MQTT, dan integrasi dengan Python ML models.

## 📋 Prerequisites

- Node.js v20+
- PostgreSQL 17
- MQTT Broker (Default: localhost:1883)

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/comvis-CnFD/comvis-api.git
cd comvis-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Buat file `.env` di root directory:

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@localhost:PORT/DATABASE

# Server
PORT=4000
JWT_SECRET=your_jwt_secret_key_here

# MQTT
MQTT_BROKER=localhost
MQTT_PORT=1883

# External Services
ML_DIR=
DATASET_DIR=
```

### 4. Database Setup

Jalankan Prisma migrations:

```bash
npx prisma generate
npx prisma db push
```

### 5. Start Server

```bash
npm run start
```

Server akan berjalan di `http://localhost:4000`

## 🏗️ Arsitektur Sistem

![Arsitektur Sistem](src/public/arsitektur-sistem.png)

Sistem ComVis API menggunakan arsitektur real-time dengan integrasi:

1. **Frontend** - Frontend berkomunikasi via Socket.IO
2. **API Server** - Express.js sebagai REST API dan WebSocket server
3. **Message Broker** - MQTT untuk komunikasi dengan Python ML services
4. **ML Processing** - Python services untuk Crowd dan Fatigue Detection
5. **Database** - PostgreSQL untuk persistent data storage

### Alur Data:

- Client mengirim video frame via Socket.IO
- Server meneruskan ke MQTT broker
- Python ML services memproses frame dan mengirim hasil
- Server menyimpan hasil ke database
- Server mengirim notifikasi real-time ke client

## 🎯 Use Case Diagram

![Use Case Diagram](src/public/use-case.png)

### Aktor & Fungsionalitas:

**User (Pengguna Biasa)**

- Login & Logout sistem
- Registrasi akun baru dengan upload foto wajah
- Mengelola profil (view, update, change password)
- Forgot password
- Mengelola area monitoring (create, read, update, delete)
- Melihat data Crowd per area
- Melakukan Crowd Detection real-time
- Melakukan Fatigue Detection real-time
- Melihat riwayat data Fatigue dan Crowd Detection

**Admin**

- Dashboard
- Mengelola users (view, update, delete)
- Melihat semua data sistem (all users, areas, crowds, fatigues)

## 💾 Database Schema

![Entity Relationship Diagram](src/public/erd.png)

**Relasi:**

- User memiliki banyak Areas (1-to-many)
- User memiliki banyak Fatigues (1-to-many)
- Area memiliki banyak Crowds (1-to-many)
- Cascade delete: Hapus user akan otomatis menghapus areas dan fatigues terkait

## 📁 Project Structure

```
src/
├── index.js                 # Main server & Socket.IO/MQTT setup
├── config/
│   ├── db.js               # Prisma client instance
│   └── multer.js           # File upload configuration
├── controllers/            # Request handlers
│   ├── AuthController.js
│   ├── UserController.js
│   ├── AreaController.js
│   ├── CrowdController.js
│   └── FatigueController.js
├── models/                 # Data access layer
│   ├── UserModel.js
│   ├── AreaModel.js
│   ├── CrowdModel.js
│   └── FatigueModel.js
├── middleware/             # Express middleware
│   ├── authenticateJWT.js
│   ├── checkAdmin.js
│   └── uploadPhotosMiddleware.js
├── routes/
│   └── index.js            # All API routes
├── utils/
│   └── deleteDirectory.js  # Helper functions
└── views/                  # EJS templates
    ├── index.ejs
    └── fatigue.ejs
```

## 🔐 Authentication

API menggunakan JWT (JSON Web Token) untuk autentikasi.

### Register

```bash
POST /register
Content-Type: multipart/form-data

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword",
  "security_answer": "my_pet_name",
  "photos": [file1, file2, ...]
}
```

**Response:**

```json
{
  "message": "Register Success"
}
```

### Login

```bash
POST /login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Using Token

Sertakan token di setiap request sebagai Bearer token:

```bash
Authorization: Bearer <your_token_here>
```

## 📊 API Endpoints

### Authentication

- `POST /login` - Login user
- `POST /register` - Register user baru
- `PATCH /resetPassword` - Reset password dengan security answer

### User Profile

- `GET /users/profile` - Ambil profil user (authenticated)
- `PATCH /users/profile` - Update profil user
- `PATCH /users/editPassword` - Update password user

### Admin (Requires admin role)

- `GET /admin/users` - Ambil semua users
- `GET /admin/users/:id` - Ambil user by ID
- `PATCH /admin/users/:id` - Update user
- `PATCH /admin/users/:id/editPassword` - Update password user
- `DELETE /admin/users/:id` - Hapus user

### Areas

- `GET /areas` - Ambil semua areas (user's areas)
- `GET /areas/:id` - Ambil area by ID
- `GET /areas/users/:user_id` - Ambil areas by user ID
- `POST /areas` - Buat area baru
- `PUT /areas/:id` - Update area
- `DELETE /areas/:id` - Hapus area

### Crowds

- `GET /crowds` - Ambil semua crowd data
- `POST /crowds` - Insert crowd data (via MQTT internal)
- `GET /crowds/:area_id` - Ambil crowd data by area ID
- `GET /crowds/users/:user_id` - Ambil crowd data by user ID

### Fatigues

- `GET /fatigues` - Ambil semua fatigue data
- `GET /fatigues/users/:user_id` - Ambil fatigue data by user ID
- `POST /fatigues` - Insert fatigue data (via MQTT internal)

## 🔄 Real-time Integration (Socket.IO)

### Client Events

#### Crowd Detection

```javascript
// Emit frame untuk crowd analysis
socket.emit("io-crowd-frame", base64Frame, capacity, area_id);
```

**Server Response:**

```javascript
socket.on("receive-crowd", (data) => {
  console.log({
    count: data.count, // Jumlah orang terdeteksi
    status: data.status, // Kosong/Sepi/Sedang/Ramai/Penuh
    area_id: data.area_id,
    createdAt: data.createdAt,
  });
});
```

#### Fatigue Detection

```javascript
// Emit frame untuk fatigue analysis
socket.emit("io-fatigue-frame", base64Frame, user_id);
```

**Server Response:**

```javascript
socket.on("receive-fatigue", (data) => {
  console.log({
    status: data.status, // Fatigue status
    user_id: data.user_id,
    createdAt: data.createdAt,
  });
});
```

## 🔌 MQTT Integration

Server subscribe ke 3 MQTT topics:

### Topics

| Topic                 | Direction | Format                     |
| --------------------- | --------- | -------------------------- |
| `mqtt-crowd-frame`    | Publish   | `base64_frame_string`      |
| `mqtt-face-frame`     | Publish   | `base64_frame_string`      |
| `mqtt-fatigue-frame`  | Publish   | `base64_frame_string`      |
| `mqtt-crowd-result`   | Subscribe | `{ "num_people": number }` |
| `mqtt-fatigue-result` | Subscribe | `{ "status": string }`     |
| `mqtt-face-result`    | Subscribe | Any JSON                   |

### Status Mapping

Crowd status dihitung berdasarkan persentase kapasitas area:

| Persentase | Status |
| ---------- | ------ |
| 0%         | Kosong |
| 1-33%      | Sepi   |
| 34-66%     | Sedang |
| 67-100%    | Ramai  |
| >100%      | Penuh  |

Thresholds dapat dikustomisasi di `src/index.js`.

## 🐛 Debugging

### Check Environment Variables

```bash
# Di PowerShell
echo $env:DATABASE_URL
```

### Check MQTT Connection

Pastikan MQTT broker berjalan:

```bash
# Default: localhost:1883
mosquitto -p 1883
```

### Database Connection Issues

```bash
# Test connection string
psql $env:DATABASE_URL
```

### View Logs

Server logs client connections dan MQTT messages. Cek console untuk error details.

## 📝 File Upload

File yang di-upload via `/register`:

- Disimpan ke `src/public/user-photos/{userId}/`
- Format: JPG, PNG, GIF
- Max size: 5MB per file (configurable di `src/config/multer.js`)

## 🔒 Security

- ✅ Passwords hashed dengan bcrypt
- ✅ JWT token authentication
- ✅ Role-based access control (admin checks)
- ✅ Sensitive fields excluded dari queries (password, security_answer)
- ✅ CORS configured untuk production use
