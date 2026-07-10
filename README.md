# GG IT Solutions ERP & LMS - Backend API

A production-grade, highly scalable backend API built with **NestJS**, powering the GG IT Solutions Enterprise Resource Planning (ERP) and Learning Management System (LMS).

---

## 🛠️ Tech Stack & Architecture

- **Core Framework:** NestJS (Node.js) with TypeScript
- **Database ORM:** TypeORM
- **Database:** PostgreSQL (Hosted on Supabase)
- **Authentication:** JWT (JSON Web Tokens) with Role-Based Access Control (RBAC)
- **Cryptography:** bcrypt (for secure password hashing)
- **Validation:** class-validator & class-transformer

---

## 📂 Project Structure

```text
backend/
├── src/
│   ├── common/                  # Shared utilities, filters, guards, and interceptors
│   │   ├── decorators/          # Custom decorators (e.g., @Roles)
│   │   ├── filters/             # Global HTTP exception filters
│   │   ├── guards/              # Authentication and Roleguards
│   │   ├── interceptors/        # Response transformer and Audit logger interceptors
│   │   └── services/            # Shared utilities (e.g., NotificationService)
│   ├── users/                   # Authentication & user management module
│   │   ├── dto/                 # Validation schemas for input data (Create/Update Dto)
│   │   ├── entities/            # TypeORM Entity mappings for Postgres
│   │   ├── users.controller.ts  # Endpoints exposing user operations
│   │   ├── users.module.ts      # Nest module registration
│   │   └── users.service.ts     # Business logic & repository queries
│   ├── app.module.ts            # Root application module (Database config, JWT setup)
│   └── main.ts                  # Application bootstrap file (CORS, Global validation pipes)
├── test/                        # Integration and E2E tests
├── .env.example                 # Standard environment variable template
├── nest-cli.json                # Nest application config
└── tsconfig.json                # TypeScript compiler config
```

---

## ⚙️ Environment Configuration

To run the application, create a `.env` file in the root of the `/backend` folder with the following variables:

```env
# Server Port Configuration
PORT=3000

# Database Settings (Supabase PostgreSQL Connection)
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_USERNAME=postgres.your_project_id
DB_PASSWORD=your_secure_password
DB_DATABASE=postgres

# JWT Configurations
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRATION=1d
```

---

## 🚀 Getting Started

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Run Database Migrations
TypeORM is configured with `synchronize: true` for development environments, which will automatically sync database tables based on Entity definitions upon server start.

### 3. Start Development Server
Run the NestJS application with hot-reload enabled:
```bash
npm run start:dev
```
*The API server will run at: `http://localhost:3000`*

### 4. Build for Production
To compile the TypeScript code into production-ready Javascript in the `/dist` directory:
```bash
npm run build
```

---

## 🔑 Authentication & API Endpoints

All responsive API payloads are standard formatted via the global `TransformInterceptor` inside `{ statusCode, message, data }` wrappers.

### Authentication Endpoints

#### `POST /users/register`
Creates a new user profile inside the database.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "roleId": 3
  }
  ```

#### `POST /users/login`
Authenticates user credentials and generates a JWT access token.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
- **Response Data:**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": {
        "id": 3,
        "name": "STUDENT"
      }
    }
  }
  ```

### User Management Endpoints

All endpoints below require a valid bearer JWT in the Authorization header: `Authorization: Bearer <token>`.

#### `GET /users/:id`
Retrieves detailed profile data of a specific user.
- *Authorization:* Accessible to `ADMIN`, or any user requesting their own profile.

#### `PATCH /users/:id`
Updates fields in the user record (e.g., First Name, Phone, Email, or Password).
- *Authorization:* Accessible to `ADMIN`, or any user updating their own profile.
- **Request Body:**
  ```json
  {
    "firstName": "Johnny",
    "phone": "+9876543210"
  }
  ```

#### `GET /users`
Lists all users registered in the system.
- *Authorization:* Restricted to `ADMIN` users only.

#### `DELETE /users/:id`
Deactivates or deletes a user profile.
- *Authorization:* Restricted to `ADMIN` users only.

---

## 🌿 Git Branching Strategy

The repository follows a clean branch workflow:
- **`main`:** Stable, production-ready code.
- **`dev`:** Active development branch where new modules (e.g., admissions, academics) are merged and tested.
- **Feature Branches:** Created for specific modules (e.g., `feature/admissions`) and merged into `dev` via Pull Requests.