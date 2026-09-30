const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireProjectMember } = require('../utils/access');

const router = express.Router();
router.use(requireAuth);

router.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    await requireProjectMember(projectId, req.session.user.id);

    const result = await pool.query(
      `SELECT
         t.id,
         t.project_id AS "projectId",
         t.title,
         t.description,
         t.status,
         t.priority,
         t.assignee_id AS "assigneeId",
         au.full_name AS "assigneeName",
         t.created_by AS "createdBy",
         cu.full_name AS "creatorName",
         t.due_date AS "dueDate",
         t.created_at AS "createdAt",
         t.updated_at AS "updatedAt",
         COUNT(c.id)::int AS "commentCount"
       FROM tasks t
       JOIN users cu ON cu.id = t.created_by
       LEFT JOIN users au ON au.id = t.assignee_id
       LEFT JOIN comments c ON c.task_id = t.id
       WHERE t.project_id = $1
       GROUP BY t.id, au.full_name, cu.full_name
       ORDER BY t.created_at DESC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not load tasks' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const taskId = Number(req.params.id);

    const taskResult = await pool.query(
      `SELECT
         t.id,
         t.project_id AS "projectId",
         t.title,
         t.description,
         t.status,
         t.priority,
         t.assignee_id AS "assigneeId",
         au.full_name AS "assigneeName",
         t.created_by AS "createdBy",
         cu.full_name AS "creatorName",
         t.due_date AS "dueDate",
         t.created_at AS "createdAt",
         t.updated_at AS "updatedAt"
       FROM tasks t
       JOIN users cu ON cu.id = t.created_by
       LEFT JOIN users au ON au.id = t.assignee_id
       WHERE t.id = $1`,
      [taskId]
    );

    const task = taskResult.rows[0];
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await requireProjectMember(task.projectId, req.session.user.id);
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not load task' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      projectId,
      title,
      description = '',
      status = 'TODO',
      priority = 'MEDIUM',
      assigneeId = null,
      dueDate = null
    } = req.body;

    await requireProjectMember(Number(projectId), req.session.user.id);

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    if (assigneeId) {
      await requireProjectMember(Number(projectId), Number(assigneeId));
    }

    const result = await pool.query(
      `INSERT INTO tasks
        (project_id, title, description, status, priority, assignee_id, created_by, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        Number(projectId),
        title.trim(),
        description.trim(),
        status,
        priority,
        assigneeId ? Number(assigneeId) : null,
        req.session.user.id,
        dueDate || null
      ]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not create task' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const existingResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await requireProjectMember(existing.project_id, req.session.user.id);

    const title = req.body.title ?? existing.title;
    const description = req.body.description ?? existing.description;
    const status = req.body.status ?? existing.status;
    const priority = req.body.priority ?? existing.priority;
    const dueDate = req.body.dueDate === undefined ? existing.due_date : (req.body.dueDate || null);
    const assigneeId = req.body.assigneeId === undefined
      ? existing.assignee_id
      : (req.body.assigneeId ? Number(req.body.assigneeId) : null);

    if (assigneeId) {
      await requireProjectMember(existing.project_id, assigneeId);
    }

    await pool.query(
      `UPDATE tasks
       SET title = $1,
           description = $2,
           status = $3,
           priority = $4,
           assignee_id = $5,
           due_date = $6,
           updated_at = NOW()
       WHERE id = $7`,
      [title.trim(), description.trim(), status, priority, assigneeId, dueDate, taskId]
    );

    res.json({ message: 'Task updated' });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not update task' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { status } = req.body;
    const allowed = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid task status' });
    }

    const task = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    if (!task.rowCount) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await requireProjectMember(task.rows[0].project_id, req.session.user.id);

    await pool.query(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, taskId]
    );

    res.json({ message: 'Task status updated' });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not update task status' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const task = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);

    if (!task.rowCount) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await requireProjectMember(task.rows[0].project_id, req.session.user.id);
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not delete task' });
  }
});

module.exports = router;
