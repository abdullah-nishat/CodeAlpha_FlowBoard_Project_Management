const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireProjectMember, requireProjectOwner } = require('../utils/access');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.description,
         pm.role,
         p.created_at AS "createdAt",
         COUNT(DISTINCT pm2.user_id)::int AS "memberCount",
         COUNT(DISTINCT t.id)::int AS "taskCount",
         COUNT(DISTINCT CASE WHEN t.status = 'DONE' THEN t.id END)::int AS "doneCount"
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       LEFT JOIN project_members pm2 ON pm2.project_id = p.id
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE pm.user_id = $1
       GROUP BY p.id, pm.role
       ORDER BY p.updated_at DESC, p.created_at DESC`,
      [req.session.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not load projects' });
  }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, description = '' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    await client.query('BEGIN');

    const projectResult = await client.query(
      `INSERT INTO projects (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at AS "createdAt"`,
      [name.trim(), description.trim(), req.session.user.id]
    );

    const project = projectResult.rows[0];

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [project.id, req.session.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ project });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Could not create project' });
  } finally {
    client.release();
  }
});

router.get('/:id/available-users', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    await requireProjectOwner(projectId, req.session.user.id);

    const result = await pool.query(
      `SELECT
         u.id,
         u.full_name AS "fullName",
         u.email
       FROM users u
       WHERE u.id NOT IN (
         SELECT pm.user_id
         FROM project_members pm
         WHERE pm.project_id = $1
       )
       ORDER BY u.full_name ASC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not load available users' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const membership = await requireProjectMember(projectId, req.session.user.id);

    const projectResult = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.description,
         p.owner_id AS "ownerId",
         p.created_at AS "createdAt",
         u.full_name AS "ownerName"
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       WHERE p.id = $1`,
      [projectId]
    );

    if (!projectResult.rowCount) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const membersResult = await pool.query(
      `SELECT
         u.id,
         u.full_name AS "fullName",
         u.email,
         pm.role,
         pm.joined_at AS "joinedAt"
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY CASE WHEN pm.role = 'OWNER' THEN 0 ELSE 1 END, u.full_name`,
      [projectId]
    );

    res.json({
      project: projectResult.rows[0],
      members: membersResult.rows,
      currentRole: membership.role
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not load project' });
  }
});

router.post('/:id/members', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    await requireProjectOwner(projectId, req.session.user.id);

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Member email is required' });
    }

    const userResult = await pool.query(
      `SELECT id, full_name AS "fullName", email
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ message: 'No registered user found with that email' });
    }

    const exists = await pool.query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    if (exists.rowCount) {
      return res.status(409).json({ message: 'User is already a project member' });
    }

    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'MEMBER')`,
      [projectId, user.id]
    );

    res.status(201).json({ member: { ...user, role: 'MEMBER' } });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not add member' });
  }
});

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const userId = Number(req.params.userId);
    await requireProjectOwner(projectId, req.session.user.id);

    const project = await pool.query('SELECT owner_id FROM projects WHERE id = $1', [projectId]);
    if (project.rows[0]?.owner_id === userId) {
      return res.status(400).json({ message: 'Project owner cannot be removed' });
    }

    await pool.query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );

    await pool.query(
      `UPDATE tasks
       SET assignee_id = NULL, updated_at = NOW()
       WHERE project_id = $1 AND assignee_id = $2`,
      [projectId, userId]
    );

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not remove member' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    await requireProjectOwner(projectId, req.session.user.id);

    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Could not delete project' });
  }
});

module.exports = router;
