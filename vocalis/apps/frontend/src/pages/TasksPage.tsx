import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import {
  fetchTasks,
  updateTask,
  deleteTask,
  createTask,
  fetchDecisions,
  createDecision,
  updateDecision,
  deleteDecision,
} from '../services/apiClient';
import { TaskItem, TaskStatus, DecisionItem } from '@meeting-assistant/shared-types';

export const TasksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'decisions'>('tasks');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [taskFilter, setTaskFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick Add State
  const [newTaskText, setNewTaskText] = useState<string>('');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('You');
  const [newDecisionText, setNewDecisionText] = useState<string>('');

  // Inline Editing State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState<string>('');
  const [editTaskAssignee, setEditTaskAssignee] = useState<string>('');
  const [editTaskDueDate, setEditTaskDueDate] = useState<string>('');

  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [editDecisionText, setEditDecisionText] = useState<string>('');

  const { navigate } = useRouter();
  const { showToast } = useToast();

  const loadData = () => {
    setLoading(true);
    Promise.all([fetchTasks(), fetchDecisions()])
      .then(([tasksRes, decsRes]) => {
        if (tasksRes.data) setTasks(tasksRes.data);
        if (decsRes.data) setDecisions(decsRes.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Task Operations ---
  const handleToggleTaskStatus = async (task: TaskItem) => {
    const nextStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    showToast(nextStatus === 'done' ? 'Task marked completed' : 'Task marked to do', '', 'info');
    await updateTask(task.id, { status: nextStatus });
  };

  const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    showToast(`Status updated to ${status.replace('_', ' ')}`, '', 'success');
    await updateTask(taskId, { status });
  };

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const itemText = newTaskText.trim();
    const itemAssignee = newTaskAssignee.trim() || 'You';
    setNewTaskText('');

    try {
      const res = await createTask({
        task: itemText,
        assignee: itemAssignee,
        status: 'todo',
        dueDate: 'Next week',
      });
      if (res.data) {
        setTasks((prev) => [res.data!, ...prev]);
        showToast('Action item added', '', 'success');
      } else {
        // Fallback optimistic item
        const optimisticTask: TaskItem = {
          id: `task-${Date.now()}`,
          task: itemText,
          title: itemText,
          assignee: itemAssignee,
          priority: 'medium',
          status: 'todo',
          dueDate: 'Next week',
          meetingId: 'manual',
          meetingTitle: 'Manual Entry',
          createdAt: new Date().toISOString(),
        };
        setTasks((prev) => [optimisticTask, ...prev]);
        showToast('Action item added', '', 'success');
      }
    } catch {
      showToast('Action item added', '', 'info');
    }
  };

  const handleStartEditTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.task || task.title || '');
    setEditTaskAssignee(task.assignee || 'You');
    setEditTaskDueDate(task.dueDate || 'Next week');
  };

  const handleSaveEditTask = async (taskId: string) => {
    const trimmedTitle = editTaskTitle.trim();
    if (!trimmedTitle) {
      showToast('Task title cannot be empty', '', 'error');
      return;
    }
    const trimmedAssignee = editTaskAssignee.trim() || 'You';
    const trimmedDueDate = editTaskDueDate.trim() || 'Next week';

    // Optimistically update the UI immediately
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              task: trimmedTitle,
              title: trimmedTitle,
              assignee: trimmedAssignee,
              dueDate: trimmedDueDate,
            }
          : t
      )
    );
    setEditingTaskId(null);
    showToast('Task updated successfully', '', 'success');

    try {
      await updateTask(taskId, {
        task: trimmedTitle,
        assignee: trimmedAssignee,
        dueDate: trimmedDueDate,
      });
    } catch (err) {
      console.error('Failed to sync task update:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast('Task deleted', '', 'info');
    try {
      await deleteTask(taskId);
    } catch (err) {
      console.error('Failed to sync delete task:', err);
    }
  };

  // --- Decision Operations ---
  const handleQuickAddDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecisionText.trim()) return;
    const decText = newDecisionText.trim();
    setNewDecisionText('');

    try {
      const res = await createDecision({
        decision: decText,
        status: 'active',
      });
      if (res.data) {
        setDecisions((prev) => [res.data!, ...prev]);
        showToast('Decision logged', '', 'success');
      } else {
        const optimisticDec: DecisionItem = {
          id: `dec-${Date.now()}`,
          decision: decText,
          status: 'active',
          meetingId: 'manual',
          meetingTitle: 'Manual Entry',
          createdAt: new Date().toISOString(),
        };
        setDecisions((prev) => [optimisticDec, ...prev]);
        showToast('Decision logged', '', 'success');
      }
    } catch {
      showToast('Decision logged', '', 'info');
    }
  };

  const handleToggleDecisionStatus = async (dec: DecisionItem) => {
    const nextStatus: 'active' | 'superseded' = dec.status === 'active' ? 'superseded' : 'active';
    setDecisions((prev) => prev.map((d) => (d.id === dec.id ? { ...d, status: nextStatus } : d)));
    showToast(`Decision marked ${nextStatus}`, '', 'info');
    await updateDecision(dec.id, { status: nextStatus });
  };

  const handleStartEditDecision = (dec: DecisionItem) => {
    setEditingDecisionId(dec.id);
    setEditDecisionText(dec.decision);
  };

  const handleSaveEditDecision = async (decisionId: string) => {
    const trimmedDec = editDecisionText.trim();
    if (!trimmedDec) {
      showToast('Decision text cannot be empty', '', 'error');
      return;
    }

    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? { ...d, decision: trimmedDec } : d))
    );
    setEditingDecisionId(null);
    showToast('Decision updated successfully', '', 'success');

    try {
      await updateDecision(decisionId, { decision: trimmedDec });
    } catch (err) {
      console.error('Failed to sync decision update:', err);
    }
  };

  const handleDeleteDecision = async (decisionId: string) => {
    setDecisions((prev) => prev.filter((d) => d.id !== decisionId));
    showToast('Decision deleted', '', 'info');
    try {
      await deleteDecision(decisionId);
    } catch (err) {
      console.error('Failed to sync delete decision:', err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesFilter = taskFilter === 'all' || t.status === taskFilter;
    const taskName = t.task || t.title || '';
    const taskAssignee = t.assignee || '';
    const matchesSearch =
      !searchQuery.trim() ||
      taskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      taskAssignee.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredDecisions = decisions.filter((d) =>
    !searchQuery.trim() || d.decision.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--color-rule)', paddingBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', fontWeight: 700 }}>
            Action Items & Decisions
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)', marginTop: '0.2rem' }}>
            View, edit, and organize deliverables and agreed decisions from your meetings.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/live')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          <span>Extract Live in Meeting →</span>
        </button>
      </div>

      {/* Main Tabs: Tasks vs Decisions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', backgroundColor: 'var(--color-paper-subtle)', borderRadius: 'var(--radius-pill)', padding: '3px', border: '1px solid var(--color-rule)', gap: '3px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: activeTab === 'tasks' ? 'var(--color-paper-card)' : 'transparent',
              color: activeTab === 'tasks' ? 'var(--color-ink)' : 'var(--color-ink-muted)',
              fontWeight: activeTab === 'tasks' ? 700 : 500,
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'tasks' ? 'var(--shadow-subtle)' : 'none',
            }}
          >
            Action Items ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('decisions')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: activeTab === 'decisions' ? 'var(--color-paper-card)' : 'transparent',
              color: activeTab === 'decisions' ? 'var(--color-ink)' : 'var(--color-ink-muted)',
              fontWeight: activeTab === 'decisions' ? 700 : 500,
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'decisions' ? 'var(--shadow-subtle)' : 'none',
            }}
          >
            Agreed Decisions ({decisions.length})
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '220px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'tasks' ? 'Search tasks...' : 'Search decisions...'}
            style={{
              width: '100%',
              padding: '0.4rem 0.65rem 0.4rem 2rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-rule)',
              backgroundColor: 'var(--color-paper-card)',
              fontSize: '0.82rem',
              color: 'var(--color-ink)',
              outline: 'none',
            }}
          />
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--color-ink-subtle)" strokeWidth="2" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* --- TAB 1: ACTION ITEMS --- */}
      {activeTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Quick Task Filter Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {(['all', 'todo', 'in_progress', 'done'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTaskFilter(filter)}
                className={`btn btn-sm ${taskFilter === filter ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-pill)', textTransform: 'capitalize' }}
              >
                {filter === 'all' ? `All (${tasks.length})` : filter.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Quick Add Form */}
          <form
            onSubmit={handleQuickAddTask}
            className="luxury-card"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              border: '1px solid var(--color-rule)',
            }}
          >
            <span style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: '1.1rem' }}>+</span>
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Add a new action item and press Enter..."
              style={{ flex: 1, border: 'none', backgroundColor: 'transparent', fontSize: '0.88rem', color: 'var(--color-ink)', outline: 'none' }}
            />
            <input
              type="text"
              value={newTaskAssignee}
              onChange={(e) => setNewTaskAssignee(e.target.value)}
              placeholder="Assignee"
              style={{ width: '100px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-rule)', fontSize: '0.78rem', backgroundColor: 'var(--color-paper-subtle)' }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!newTaskText.trim()}>
              Add Task
            </button>
          </form>

          {/* Tasks List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-ink-muted)' }}>Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="luxury-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-ink-muted)', borderRadius: '16px' }}>
                No action items found. Type above to add your first item!
              </div>
            ) : (
              filteredTasks.map((t) => {
                const isDone = t.status === 'done';
                const isEditing = editingTaskId === t.id;

                if (isEditing) {
                  return (
                    <form
                      key={t.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveEditTask(t.id);
                      }}
                      className="luxury-card"
                      style={{
                        padding: '1rem',
                        borderRadius: '14px',
                        border: '2px solid var(--color-accent)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                      }}
                    >
                      <input
                        type="text"
                        value={editTaskTitle}
                        onChange={(e) => setEditTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingTaskId(null);
                        }}
                        placeholder="Task description..."
                        style={{
                          padding: '0.45rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid var(--color-rule)',
                          fontSize: '0.9rem',
                          width: '100%',
                          backgroundColor: 'var(--color-paper-card)',
                          color: 'var(--color-ink)',
                          outline: 'none',
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={editTaskAssignee}
                          onChange={(e) => setEditTaskAssignee(e.target.value)}
                          placeholder="Assignee (e.g. You, Alex)"
                          style={{
                            padding: '0.3rem 0.55rem',
                            borderRadius: '6px',
                            border: '1px solid var(--color-rule)',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--color-paper-subtle)',
                            color: 'var(--color-ink)',
                          }}
                        />
                        <input
                          type="text"
                          value={editTaskDueDate}
                          onChange={(e) => setEditTaskDueDate(e.target.value)}
                          placeholder="Due Date (e.g. Tomorrow, Friday)"
                          style={{
                            padding: '0.3rem 0.55rem',
                            borderRadius: '6px',
                            border: '1px solid var(--color-rule)',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--color-paper-subtle)',
                            color: 'var(--color-ink)',
                          }}
                        />
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.85rem' }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setEditingTaskId(null)}
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={t.id}
                    className="luxury-card"
                    style={{
                      padding: '0.9rem 1.15rem',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      border: '1px solid var(--color-rule)',
                      opacity: isDone ? 0.75 : 1,
                    }}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => handleToggleTaskStatus(t)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                    />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 600,
                          color: 'var(--color-ink)',
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}
                      >
                        {t.task || t.title}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                        <span>👤 {t.assignee || 'Unassigned'}</span>
                        <span>📅 {t.dueDate || 'Next week'}</span>
                      </div>
                    </div>

                    {/* Stage Selector */}
                    <select
                      value={t.status || 'todo'}
                      onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value as TaskStatus)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--color-rule)',
                        backgroundColor: 'var(--color-paper-subtle)',
                        fontSize: '0.76rem',
                        color: 'var(--color-ink)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Completed</option>
                    </select>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleStartEditTask(t)}
                      title="Edit task"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-accent)', fontSize: '0.9rem' }}
                    >
                      ✏️
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(t.id)}
                      title="Delete task"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-danger)', fontSize: '0.9rem' }}
                    >
                      🗑️
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: AGREED DECISIONS --- */}
      {activeTab === 'decisions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Quick Add Decision Form */}
          <form
            onSubmit={handleQuickAddDecision}
            className="luxury-card"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              border: '1px solid var(--color-rule)',
            }}
          >
            <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '1.1rem' }}>✓</span>
            <input
              type="text"
              value={newDecisionText}
              onChange={(e) => setNewDecisionText(e.target.value)}
              placeholder="Log an agreed key decision and press Enter..."
              style={{ flex: 1, border: 'none', backgroundColor: 'transparent', fontSize: '0.88rem', color: 'var(--color-ink)', outline: 'none' }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!newDecisionText.trim()}>
              Log Decision
            </button>
          </form>

          {/* Decisions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-ink-muted)' }}>Loading decisions...</div>
            ) : filteredDecisions.length === 0 ? (
              <div className="luxury-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-ink-muted)', borderRadius: '16px' }}>
                No decisions recorded yet. Log your team's agreements above!
              </div>
            ) : (
              filteredDecisions.map((dec) => {
                const isSuperseded = dec.status === 'superseded';
                const isEditing = editingDecisionId === dec.id;

                if (isEditing) {
                  return (
                    <form
                      key={dec.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveEditDecision(dec.id);
                      }}
                      className="luxury-card"
                      style={{
                        padding: '1rem',
                        borderRadius: '14px',
                        border: '2px solid var(--color-accent)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                      }}
                    >
                      <input
                        type="text"
                        value={editDecisionText}
                        onChange={(e) => setEditDecisionText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingDecisionId(null);
                        }}
                        placeholder="Decision description..."
                        style={{
                          padding: '0.45rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid var(--color-rule)',
                          fontSize: '0.9rem',
                          width: '100%',
                          backgroundColor: 'var(--color-paper-card)',
                          color: 'var(--color-ink)',
                          outline: 'none',
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.85rem' }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setEditingDecisionId(null)}
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={dec.id}
                    className="luxury-card"
                    style={{
                      padding: '0.9rem 1.15rem',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      border: '1px solid var(--color-rule)',
                      backgroundColor: isSuperseded ? 'var(--color-paper-subtle)' : 'var(--color-paper-card)',
                      opacity: isSuperseded ? 0.65 : 1,
                    }}
                  >
                    <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '1rem' }}>✓</span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 600,
                          color: 'var(--color-ink)',
                          textDecoration: isSuperseded ? 'line-through' : 'none',
                        }}
                      >
                        {dec.decision}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>
                        Status: {dec.status || 'active'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleToggleDecisionStatus(dec)}
                      style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
                    >
                      {isSuperseded ? 'Activate' : 'Supersede'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEditDecision(dec)}
                      title="Edit decision"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-accent)', fontSize: '0.9rem' }}
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteDecision(dec.id)}
                      title="Delete decision"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-danger)', fontSize: '0.9rem' }}
                    >
                      🗑️
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
