import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { initialTasks, taskSectionOrder, taskSectionLabels } from '../data/mockData';

const PERSON_PILLS = [
  { id: 'all', label: 'All', cls: '' },
  { id: 'trey', label: 'Trey', cls: 'teal' },
  { id: 'beryl', label: 'Beryl', cls: 'purple' },
  { id: 'kids', label: 'Kids', cls: 'amber' },
  { id: 'family', label: 'Family', cls: 'coral' },
];

const TIME_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'later', label: 'Later' },
];

function timeBucket(dueStr) {
  if (!dueStr) return 'later';
  const due = new Date(`${dueStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays <= 7) return 'week';
  return 'later';
}

function dueLabel(dueStr, done) {
  if (done) return 'Done';
  if (!dueStr) return 'No due date';
  const due = new Date(`${dueStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays === 0) return 'Due today';
  if (diffDays < 0) return 'Overdue';
  return due.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function personLabel(key) {
  if (key === 'kids') return 'Kids';
  if (key === 'family') return 'Family';
  return key[0].toUpperCase() + key.slice(1);
}

export default function TasksPage() {
  const { tasksLive, personTasks, toggleTaskLive, addTaskLive } = useApp();
  const [mockTasks, setMockTasks] = useState(initialTasks);
  const [personFilter, setPersonFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [newTaskText, setNewTaskText] = useState('');
  const [addPerson, setAddPerson] = useState('family');

  const tasks = tasksLive
    ? personTasks.map((t) => ({ id: t.id, text: t.text, person: t.key, done: t.done, time: timeBucket(t.due), due: dueLabel(t.due, t.done), raw: t }))
    : mockTasks;

  const toggleTask = (task) => {
    if (tasksLive) toggleTaskLive(task.raw);
    else setMockTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
  };

  const addTask = () => {
    const text = newTaskText.trim();
    if (!text) return;
    if (tasksLive) {
      addTaskLive(personFilter === 'all' ? addPerson : personFilter, text);
    } else {
      setMockTasks((prev) => [...prev, { id: `t-${Date.now()}`, text, person: 'family', time: 'today', due: 'Due today', done: false }]);
    }
    setNewTaskText('');
  };

  const openCount = tasks.filter((t) => !t.done).length;
  const dueTodayCount = tasks.filter((t) => !t.done && t.time === 'today').length;

  return (
    <div className="page full-page active" id="page-tasks">
      <div className="fp-sidebar">
        <div style={{ marginBottom: '0.4em' }}>
          <div className="fp-title">Tasks</div>
          <div className="fp-subtitle">{openCount} open · {dueTodayCount} due today</div>
        </div>

        <div className="filter-section-label">Filter by person</div>
        <div className="filter-row">
          {PERSON_PILLS.map((p) => (
            <div
              key={p.id}
              className={`fpill ${p.cls}${personFilter === p.id ? ' on' : ''}`}
              onClick={() => setPersonFilter(p.id)}
            >
              {p.label}
            </div>
          ))}
        </div>

        <div className="filter-section-label">Filter by time</div>
        <div className="filter-row">
          {TIME_PILLS.map((t) => (
            <div
              key={t.id}
              className={`fpill${timeFilter === t.id ? ' on' : ''}`}
              onClick={() => setTimeFilter(t.id)}
            >
              {t.label}
            </div>
          ))}
        </div>

        {tasksLive && (
          <div>
            <div className="filter-section-label">New task goes to</div>
            <div className="filter-row">
              {PERSON_PILLS.filter((p) => p.id !== 'all').map((p) => (
                <div
                  key={p.id}
                  className={`fpill ${p.cls}${addPerson === p.id ? ' on' : ''}`}
                  onClick={() => setAddPerson(p.id)}
                >
                  {p.label}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="add-row" style={{ marginTop: 'auto', paddingTop: '0.8em', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <input
            className="add-input"
            placeholder="Add a task..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
          />
          <button className="add-btn" onClick={addTask}>Add</button>
        </div>
      </div>

      <div className="fp-main" style={{ overflow: 'hidden' }}>
        <div className="task-scroll">
          {taskSectionOrder.map((section) => {
            const items = tasks.filter((t) =>
              t.time === section &&
              (personFilter === 'all' || t.person === personFilter) &&
              (timeFilter === 'all' || t.time === timeFilter)
            );
            if (!items.length) return null;
            return (
              <div key={section}>
                <div className="task-section-head">{taskSectionLabels[section]}</div>
                {items.map((task) => (
                  <div
                    key={task.id}
                    className={`task-item${task.done ? ' done' : ''}`}
                    onClick={() => toggleTask(task)}
                  >
                    <div className={`task-cb${task.done ? ' checked' : ''}`} />
                    <div>
                      <div className="task-text">{task.text}</div>
                      <div className="task-meta">
                        <span className={`task-due${task.due === 'Overdue' ? ' overdue' : ''}`}>{task.due}</span>
                        <span className={`task-tag tag-${task.person}`}>{personLabel(task.person)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
