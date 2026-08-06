import { useState } from 'react';
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

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [personFilter, setPersonFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [newTaskText, setNewTaskText] = useState('');

  const toggleTask = (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const addTask = () => {
    const text = newTaskText.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: `t-${Date.now()}`, text, person: 'family', time: 'today', due: 'Due today', done: false }]);
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
                    onClick={() => toggleTask(task.id)}
                  >
                    <div className={`task-cb${task.done ? ' checked' : ''}`} />
                    <div>
                      <div className="task-text">{task.text}</div>
                      <div className="task-meta">
                        <span className="task-due">{task.done ? 'Done' : task.due}</span>
                        <span className={`task-tag tag-${task.person}`}>
                          {task.person === 'kids' ? 'Kids' : task.person === 'family' ? 'Family' : task.person[0].toUpperCase() + task.person.slice(1)}
                        </span>
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
