require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/projects.routes');
const taskRoutes = require('./routes/tasks.routes');
const commentRoutes = require('./routes/comments.routes');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new pgSession({
      pool,
      createTableIfMissing: true,
      tableName: 'user_sessions'
    }),
    secret: process.env.SESSION_SECRET || 'flowboard-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error' });
});

pool.query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FlowBoard running at http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  });
