# Auth Practice API with Supabase & Express

A secured RESTful API built with **Node.js**, **Express**, and **Supabase Auth**. It implements full user authentication (sign-up, login, logout) alongside route protection using custom middleware and interactive Swagger UI documentation with Bearer token support.

---

### ⚙️ Environment Configuration

Clone the repository:
   ```bash
   git clone <YOUR_REPO_URL>
   cd <YOUR_REPO_FOLDER>
   ```
   
Copy .env.example into a new .env file:
  ```bash
  cp .env.example .env
  ```
Fill in your Supabase credentials in .env:
  ```bash
  SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
  SUPABASE_KEY=your_supabase_anon_key
  PORT=3000
  ```

### Running the Project

Install dependencies and start the server with:

  ```bash
  npm install
  node index.js
  ```

- Server: http://localhost:3000

- Interactive Documentation (Swagger UI): http://localhost:3000/docs

### API Reference

| Method | Endpoint           | Auth Required? | Description                                     | Success Status     | Error Statuses                       |
|:------:|:-------------------|:---------------|:------------------------------------------------|:-------------------|-------------------------------------:|
|GET     | /public/info       | NO             | Public lobby endpoint                           | 200 OK             | -                                    |
|POST    | /auth/signup       | NO             | Register a new user with email & password	     | 201 Created        | 400 Bad Request                      |
|POST    | /auth/login        | NO             | Authenticate user and receive JWT access_token  | 200 OK             | 400 Bad Request, 401 Unauthorized    |
|GET     | /protected/profile | YES            | Returns authenticated user profile metadata     | 200 OK             | 401 Unauthorized                     |
|POST    | /tasks,            | YES            | Revokes user session and logs out               | 204 No Content     | 401 Unauthorized                     |

### Interactive Documentation (Swagger UI)
Protected endpoints can be tested directly from the browser:

1. Navigate to http://localhost:3000/docs.
2. Execute POST /auth/login to obtain an access_token.
3. Click the green Authorize (lock) button at the top right, paste the token, and click Authorize.
4. Test any protected route (/protected/profile, /auth/logout).

### Swagger UI Screenshot:

<img width="1122" height="2627" alt="localhost_3000_docs_" src="https://github.com/user-attachments/assets/314033e4-040c-40db-8d76-ec526788ba99" />


















