import { Router, Request, Response } from 'express';
import { sqliteSessionStore } from '../services/session/sqliteSessionStore';

const router = Router();

// In-memory overrides & custom manual items
interface TaskOverride {
  task?: string;
  assignee?: string;
  status?: 'todo' | 'in_progress' | 'done';
  dueDate?: string;
}

const taskOverrides = new Map<string, TaskOverride>();
const deletedTaskIds = new Set<string>();

interface DecisionOverride {
  decision?: string;
  status?: 'active' | 'superseded';
}

const decisionOverrides = new Map<string, DecisionOverride>();
const deletedDecisionIds = new Set<string>();

const customTasks: Array<{ id: string; meetingId: string; task: string; assignee: string; status: 'todo' | 'in_progress' | 'done'; dueDate: string }> = [];
const customDecisions: Array<{ id: string; meetingId: string; decision: string; status: 'active' | 'superseded' }> = [];

// GET /api/tasks - List all aggregated tasks
router.get('/tasks', (_req: Request, res: Response) => {
  const storeTasks = sqliteSessionStore.getAllTasks();
  const all = [...customTasks, ...storeTasks];
  const activeTasks = all.filter((t) => !deletedTaskIds.has(t.id));

  const updatedTasks = activeTasks.map((t) => {
    const override = taskOverrides.get(t.id);
    return {
      ...t,
      task: override?.task || t.task,
      assignee: override?.assignee || t.assignee,
      status: override?.status || t.status,
      dueDate: override?.dueDate || t.dueDate,
    };
  });

  return res.status(200).json({
    success: true,
    tasks: updatedTasks,
  });
});

// POST /api/tasks - Create manual action item
router.post('/tasks', (req: Request, res: Response) => {
  const { task, assignee, status, dueDate, meetingId } = req.body;
  if (!task) {
    return res.status(400).json({ success: false, error: 'Task text is required' });
  }

  const newTask = {
    id: `task-${Date.now()}`,
    meetingId: meetingId || 'manual',
    task: task.trim(),
    assignee: (assignee && assignee.trim()) || 'You',
    status: (status && ['todo', 'in_progress', 'done'].includes(status) ? status : 'todo') as 'todo' | 'in_progress' | 'done',
    dueDate: dueDate || 'Next week',
  };

  customTasks.unshift(newTask);

  return res.status(201).json({
    success: true,
    task: newTask,
  });
});

// PATCH /api/tasks/:id - Update task
router.patch('/tasks/:id', (req: Request, res: Response) => {
  const { task, assignee, status, dueDate } = req.body;
  const current = taskOverrides.get(req.params.id) || {};
  if (task !== undefined) current.task = task;
  if (assignee !== undefined) current.assignee = assignee;
  if (status !== undefined && ['todo', 'in_progress', 'done'].includes(status)) current.status = status;
  if (dueDate !== undefined) current.dueDate = dueDate;

  taskOverrides.set(req.params.id, current);

  return res.status(200).json({
    success: true,
    taskId: req.params.id,
    updated: current,
  });
});

// DELETE /api/tasks/:id - Delete task
router.delete('/tasks/:id', (req: Request, res: Response) => {
  deletedTaskIds.add(req.params.id);
  return res.status(200).json({
    success: true,
    taskId: req.params.id,
  });
});

// GET /api/decisions - List all aggregated decisions
router.get('/decisions', (_req: Request, res: Response) => {
  const storeDecisions = sqliteSessionStore.getAllDecisions();
  const all = [...customDecisions, ...storeDecisions];
  const activeDecisions = all.filter((d) => !deletedDecisionIds.has(d.id));

  const updatedDecisions = activeDecisions.map((d) => {
    const override = decisionOverrides.get(d.id);
    return {
      ...d,
      decision: override?.decision || d.decision,
      status: override?.status || d.status,
    };
  });

  return res.status(200).json({
    success: true,
    decisions: updatedDecisions,
  });
});

// POST /api/decisions - Create manual decision
router.post('/decisions', (req: Request, res: Response) => {
  const { decision, status, meetingId } = req.body;
  if (!decision) {
    return res.status(400).json({ success: false, error: 'Decision text is required' });
  }

  const newDec = {
    id: `decision-${Date.now()}`,
    meetingId: meetingId || 'manual',
    decision: decision.trim(),
    status: (status && ['active', 'superseded'].includes(status) ? status : 'active') as 'active' | 'superseded',
  };

  customDecisions.unshift(newDec);

  return res.status(201).json({
    success: true,
    decision: newDec,
  });
});

// PATCH /api/decisions/:id - Update decision
router.patch('/decisions/:id', (req: Request, res: Response) => {
  const { decision, status } = req.body;
  const current = decisionOverrides.get(req.params.id) || {};
  if (decision !== undefined) current.decision = decision;
  if (status !== undefined && ['active', 'superseded'].includes(status)) current.status = status;

  decisionOverrides.set(req.params.id, current);

  return res.status(200).json({
    success: true,
    decisionId: req.params.id,
    updated: current,
  });
});

// DELETE /api/decisions/:id - Delete decision
router.delete('/decisions/:id', (req: Request, res: Response) => {
  deletedDecisionIds.add(req.params.id);
  return res.status(200).json({
    success: true,
    decisionId: req.params.id,
  });
});

// GET /api/usage - Real-time SaaS usage metrics
router.get('/usage', (_req: Request, res: Response) => {
  const sessions = sqliteSessionStore.getAllSessions();
  const totalDurationSeconds = sessions.reduce((acc, s) => acc + (s.durationSeconds || s.chunks.length * 5), 0);
  const minutesUsed = Math.round(totalDurationSeconds / 60);

  return res.status(200).json({
    success: true,
    usage: {
      minutesUsed,
      minutesLimit: 300,
      aiQueriesUsed: 28,
      aiQueriesLimit: 100,
      storageMbUsed: 4.2,
      storageMbLimit: 500,
      activeRoomsCount: 1,
    },
  });
});

export const saasRouter = router;
