require('dotenv').config();
const express = require('express');
const supabase = require('./supabase');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const { pool, initDB } = require('./db');

const app = express();
const port = 3000;

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Initialize the PostgreSQL database and seed it with initial tasks if empty
//initDB().catch(err => {
//  console.error('Failed to initialize database:', err);
//});

//Root & Health endpoints

app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks', '/stats', '/reset']
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'ok',
      db: 'ok'
    });
  } catch (err) {
    console.error('Health check DB error:', err);
    res.status(503).json({
      status: 'error',
      db: 'down'
    });
  }
});

// Reset endpoint (Seeds back to initial 3 tasks)
app.post('/reset', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE tasks RESTART IDENTITY');
    await pool.query(`
      INSERT INTO tasks (title, done) VALUES 
        ('Wash the dishes', false),
        ('clean the house', true),
        ('walk the dog', false);
    `);
    const tasks = await pool.query('SELECT * FROM tasks ORDER BY id ASC');
    res.status(200).json({
      message: 'Tasks reset to initial state',
      tasks: tasks.rows,
    });
  } catch (err) {
    console.error('Error resetting tasks:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /tasks
//To get entire list of tasks, you can use the following curl command:
//curl -i http://localhost:3000/tasks
app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'database Error' });
  }
});

// because I was using windows had to test with:
// curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d "{""title"":""play video games""}" 
// in the cmd as otherwise it wouldn't read de """" properly
///GET /tasks/:ID
app.get('/tasks/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (err) {
    console.error('Error fetching task by id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

//create a new task 
//POST /tasks
app.post('/tasks', async(req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Bad Request'});
  }
  try {
    const result = await pool.query('INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *', [title, false]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Database error' });
  }
  res.status(201).json(newTask);
});

// update a task by id
// PUT /tasks/:id
app.put('/tasks/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const { title, done } = req.body;

  // Validate body: at least one field must be provided
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'Empty/invalid body' });
  }

  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'Empty/invalid body' });
  }

  if (done !== undefined && typeof done !== 'boolean') {
    return res.status(400).json({ error: 'Empty/invalid body' });
  }

  try {
    // First, fetch the current task to preserve unmodified fields
    const current = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Unknown id' });
    }

    const newTitle = title !== undefined ? title.trim() : current.rows[0].title;
    const newDone = done !== undefined ? done : current.rows[0].done;

    const result = await pool.query(
      'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
      [newTitle, newDone, taskId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// change title: curl -i -X PUT http://localhost:3000/tasks/1 -H "Content-Type: application/json" -d "{\"title\": \"title change\"}"
// change done : curl -i -X PUT http://localhost:3000/tasks/1 -H "Content-Type: application/json" -d "{\"done\": true}"




///delete a task by id
/// DELETE /tasks/:id

app.delete('/tasks/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [taskId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unknown id' });
    }
    return res.status(204).json();
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

//curl -i -X DELETE http://localhost:3000/tasks/


// POST /auth signup endpoint
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Bad Request' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    }); 
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ user: 'Created', data: data.user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({});
  }
});


// POST /autg/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid login credentials' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      return res.status(400).json({ error: 'Invalid login credentials' });
    }

    res.status(200).json({ 
      accessToken: data.session.access_token, 
      refreshToken: data.session.refresh_token,
      user: data.user, session: data.session, 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({});
  }
});

//tests:
//Missing password -> 400 Bad Request
//curl -i -X POST http://localhost:3000/auth/signup -H "Content-Type: application/json" -d "{""email"":""test@example.com""}"
//sign up new user (201 Created)
//curl -i -X POST http://localhost:3000/auth/signup -H "Content-Type: application/json" -d "{""email"":""test@example.com"",""password"":""password123""}"
//Log in (200 OK returning access_token):
//curl -i -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{""email"":""test@example.com"",""password"":""password123""}"
//Invalid login test (401 Unauthorized):
//curl -i -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{""email"":""test@example.com"",""password"":""wrongpassword""}"
 
// GET /public/info
app.get('/public/info', async (req, res) => {
  res.status(200).json({
    message: '"Welcome stranger! This info is public.',
  });
});

// GET /protected/profile 
app.get('/protected/profile', requireAuth, (req, res) => {
  res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at,
  });
});

// GET /protected/dashboard
app.get('/protected/dashboard', requireAuth, (req, res) => {
  res.status(200).json({
    message: `Welcome to your dashboard, ${req.user.email}!`,
    userId: req.user.id,
  });
});

// POST /auth/logout
app.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    // 204 No Content on success
    res.status(204).send();
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json();
  }
});

//Log in to get a fresh token:
//curl -i -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{""email"":""test@example.com"",""password"":""password123""}"

//Send the valid token (200 OK):
//curl -i http://localhost:3000/protected/profile -H "Authorization: Bearer YOUR_COPIED_ACCESS_TOKEN"

//Tamper test (401 Unauthorized):
//curl -i http://localhost:3000/protected/profile -H "Authorization: Bearer INVALID_OR_TAMPERED_TOKEN"

//logging out(204 no content)
//curl -i -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

// Middleware
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bad request' });
  }

  const token = authHeader.split(' ')[1];

  if (!token || token.trim() === '') {
    return res.status(401).json({ error: 'Bad request' });
  }
  try {
    const {data: {user}, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({});
  }
}



  
//port confirmation message

app.listen(port, () => {
  console.log(`Example app listening on port ${port} and connected to Supabase`);
});



