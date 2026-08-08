import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { initialGroceries, storeLabels, storeIcons, frequentGroceryItems } from '../data/mockData';

const STORES = ['grocery', 'costco', 'other'];

export default function GroceriesPage() {
  const { tasksLive, groceryTasks, toggleTaskLive, addTaskLive, clearCheckedLive, refetchTasks } = useApp();
  const [mockLists, setMockLists] = useState(initialGroceries);
  const [activeStore, setActiveStore] = useState('grocery');
  const [newItemText, setNewItemText] = useState('');

  // Pick up edits made directly in Google Tasks as soon as this tab is
  // opened, rather than waiting for the 5-minute background poll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tasksLive) refetchTasks(); }, []);

  const lists = tasksLive
    ? Object.fromEntries(STORES.map((store) => [
        store,
        groceryTasks.filter((t) => t.key === store).map((t) => ({ id: t.id, text: t.text, done: t.done, raw: t })),
      ]))
    : mockLists;

  const toggleItem = (store, item) => {
    if (tasksLive) toggleTaskLive(item.raw);
    else setMockLists((prev) => ({ ...prev, [store]: prev[store].map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) }));
  };

  const addItem = (store, text) => {
    if (!text.trim()) return;
    if (tasksLive) {
      addTaskLive(store, text.trim());
    } else {
      setMockLists((prev) => ({ ...prev, [store]: [...prev[store], { id: `${store}-${Date.now()}`, text: text.trim(), done: false }] }));
    }
  };

  const clearChecked = () => {
    if (tasksLive) clearCheckedLive(activeStore);
    else setMockLists((prev) => ({ ...prev, [activeStore]: prev[activeStore].filter((item) => !item.done) }));
  };

  // "Added" is derived from the list itself (an active, unchecked item with a
  // matching name) rather than tracked separately — so checking the item off
  // (or clearing it) automatically frees up the chip to add it again.
  const isFreqActive = (name) => lists[activeStore].some((item) => item.text === name && !item.done);

  const toggleFreqItem = (chip) => {
    const name = chip.replace(/^\S+\s/, '');
    if (!isFreqActive(name)) addItem(activeStore, name);
  };

  return (
    <div className="page full-page active" id="page-groceries">
      <div className="fp-sidebar">
        <div style={{ marginBottom: '0.6em' }}>
          <div className="fp-title">Groceries</div>
          <div className="fp-subtitle">{storeLabels[activeStore]} · {lists[activeStore].length} items</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em', marginBottom: '0.8em' }}>
          {STORES.map((store) => (
            <div
              key={store}
              className={`store-tab${activeStore === store ? ' active' : ''}`}
              onClick={() => setActiveStore(store)}
            >
              {storeIcons[store]} {storeLabels[store]}
              <span className="store-count">{lists[store].length}</span>
            </div>
          ))}
        </div>

        <div className="freq-section">
          <div className="freq-label">Frequently added</div>
          <div className="freq-chips">
            {frequentGroceryItems.map((chip) => {
              const name = chip.replace(/^\S+\s/, '');
              const active = isFreqActive(name);
              return (
                <div
                  key={chip}
                  className={`freq-chip${active ? ' added' : ''}`}
                  onClick={() => toggleFreqItem(chip)}
                >
                  {active ? `✓ ${name}` : chip}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: '0.8em', paddingTop: '0.8em', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div className="add-row" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <input
              className="add-input"
              placeholder="Add item..."
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { addItem(activeStore, newItemText); setNewItemText(''); }
              }}
            />
            <button className="add-btn" onClick={() => { addItem(activeStore, newItemText); setNewItemText(''); }}>Add</button>
          </div>
        </div>

        <div style={{ marginTop: '0.5em' }}>
          <button className="add-btn" style={{ width: '100%', padding: '0.5em', fontSize: '0.85em', justifyContent: 'center' }} onClick={clearChecked}>
            Clear checked items
          </button>
        </div>
      </div>

      <div className="fp-main" style={{ overflow: 'hidden' }}>
        <div className="grocery-list-full" style={{ overflowY: 'auto', flex: 1 }}>
          {lists[activeStore].map((item) => (
            <div
              key={item.id}
              className={`g-full-item${item.done ? ' checked' : ''}`}
              onClick={() => toggleItem(activeStore, item)}
            >
              <div className={`g-full-cb${item.done ? ' on' : ''}`} />
              <span className="g-full-text">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
