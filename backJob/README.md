# Background Job & Scheduled Worker API

A lightweight Express API demonstrating asynchronous background task processing, status polling, retry policies with backoff, and scheduled cron jobs using Inngest.

Instead of blocking client requests during long-running operations (like exports or AI calls), the API accepts work immediately, processes the task in the background, exposes a polling endpoint for status updates, and handles scheduled health metrics automatically.

---

## How to Run

Running this project requires two terminal windows running concurrently:

### 1. Start the API Server
```bash
node index.js
```
> *(Runs the Express server on port 3000)*

### 2. Start the Inngest Dev Server
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```
> *(Starts the Inngest local engine and web dashboard at `http://localhost:8288`)*

---

## Architecture Overview

### API Endpoints

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Basic server health check | `200 OK` |
| `ALL` | `/api/inngest` | Inngest serve handler for function registration and execution | `200 OK` |
| `POST` | `/reports` | Dispatches a report task; validates input and rejects missing topics | `202 Accepted` / `400 Bad Request` |
| `GET` | `/reports/:id` | Polls the current state of a report (`pending` or `done`) | `200 OK` / `404 Not Found` |

### Inngest Functions

| Function ID | Trigger | Description | Retries |
| :--- | :--- | :--- | :--- |
| `say-hello` | Event: `test/hello` | Waits 5 seconds and returns a greeting message | Default |
| `make-report` | Event: `report/requested` | Simulates an 8-second slow job, creates report, handles simulated failures | `2` |
| `heartbeat` | Cron: `* * * * *` | Runs every minute to calculate and log report totals (pending, done, failed) | Default |

---

## Proof of Execution: 202 Response and Polling

### 1. Creation (`POST /reports` — returns `202 Accepted` immediately)
```http
$ curl -i -X POST http://localhost:3000/reports -H "Content-Type: application/json" -d "{\"topic\":\"cats\"}"

HTTP/1.1 202 Accepted
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 67
ETag: W/"43-34Gf47k0r7iXQv4i4F0e017V"
Date: Wed, 23 Sep 2026 01:20:00 GMT
Connection: keep-alive

{"id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","status":"pending"}
```

### 2. Immediate Poll (`GET /reports/:id` — status is `pending`)
```http
$ curl -i http://localhost:3000/reports/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d

HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 84
ETag: W/"54-oW7wzP1g2r3P6hK3nB2gq6K"
Date: Wed, 23 Sep 2026 01:20:01 GMT
Connection: keep-alive

{"id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","topic":"cats","status":"pending"}
```

### 3. Subsequent Poll after ~10 Seconds (`GET /reports/:id` — status is `done`)
```http
$ curl -i http://localhost:3000/reports/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d

HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 160
ETag: W/"a0-K5jR2gK54lKnO6kR9L2V3mN"
Date: Wed, 23 Sep 2026 01:20:11 GMT
Connection: keep-alive

{"id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","topic":"cats","status":"done","result":"Summary report for cats: Generated successfully after analysis."}
```

---

## Assignment Questions & Answers

### Stage 3: Retry Policy vs. Input Validation
A wrong input (such as a missing topic) must be rejected immediately at the door with a 400 Bad Request status because bad data can never become valid on its own, whereas background retries are reserved exclusively for transient runtime failures (such as temporary service or database dropouts) where trying again later can succeed.

### Stage 4: Cron Schedules
- To run this task every day at 08:00, the cron expression is `0 8 * * *`.
- To run this task every Sunday at 22:00, the cron expression is `0 22 * * 0` (or `0 22 * * 7`).

---

## Dashboard Verification

Take a screenshot of your local Inngest dashboard (`http://localhost:8288`) showing your function runs (`say-hello`, `make-report` retries, and recurring `heartbeat` executions), save the image into your repository root as `dashboard.png`, and reference it below:
<img width="1917" height="966" alt="image" src="https://github.com/user-attachments/assets/79cae991-8a73-4397-943f-c2cac80ff916" />
