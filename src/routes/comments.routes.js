const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireProjectMember } = require('../utils/access');

const router = express.Router();
router.use(requireAuth);

async function getTaskProject(taskId) {
  const result = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
  return result.rows[0]?.project_id || null;
}

router.get('/task/:taskId', async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const projectId = await getTaskProject(taskId);

    if (!projectId) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await requireProjectMember(projectId, req.session.user.id);

    const result = await pool.query(
      `SELECT
         c.id,
         c.content,
         c.user_id AS "userId",
         u.full_name AS "userName",
         c.created_at AS "createdAt"
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not load comments' });
  }
});

router.post('/task/:taskId', async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const projectId = await getTaskProject(taskId);

    if (!projectId) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await requireProjectMember(projectId, req.session.user.id);

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }

    const result = await pool.query(
      `INSERT INTO comments (task_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at AS "createdAt"`,
      [taskId, req.session.user.id, content.trim()]
    );

    res.status(201).json({
      ...result.rows[0],
      userId: req.session.user.id,
      userName: req.session.user.fullName
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not add comment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const result = await pool.query(
      `SELECT c.user_id, t.project_id
       FROM comments c
       JOIN tasks t ON t.id = c.task_id
       WHERE c.id = $1`,
      [commentId]
    );

    const comment = result.rows[0];
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    await requireProjectMember(comment.project_id, req.session.user.id);

    if (comment.user_id !== req.session.user.id) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not delete comment' });
  }
});

module.exports = router;
