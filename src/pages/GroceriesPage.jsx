import { useState } from 'react';
import { initialGroceries, storeLabels, storeIcons, frequentGroceryItems } from '../data/mockData';

const STORES = ['grocery', 'costco', 'other'];

export default function GroceriesPage() {
  const [lists, setLists] = useState(initialGroceries);
  const [activeStore, setActiveStore] = useState('grocery');
  const [addedFreq, setAddedFreq] = useState(() => new Set());
  const [newItemText, setNewItemText] = useState('');

  const toggleItem = (store, id) => {
    setLists((prev) => ({
      ...prev,
      [store]: prev[store].map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    }));
  };

  const addItem = (store, text) => {
    if (!text.trim()) return;
    setLists((prev) => ({
      ...prev,
      [store]: [...prev[store], { id: `${store}-${Date.now()}`, text: text.trim(), done: false }],
    }));
  };

  const clearChecked = () => {
    setLists((prev) => ({
      ...prev,
      [activeStore]: prev[activeStore].filter((item) => !item.done),
    }));
  };

  const toggleFreqItem = (chip) => {
    const name = chip.replace(/^\S+\s/, '');
    setAddedFreq((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else { next.add(chip); addItem(activeStore, name); }
      return next;
    });
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
            {frequentGroceryItems.map((chip) => (
              <div
                key={chip}
                className={`freq-chip${addedFreq.has(chip) ? ' added' : ''}`}
                onClick={() => toggleFreqItem(chip)}
              >
                {addedFreq.has(chip) ? `✓ ${chip.replace(/^\S+\s/, '')}` : chip}
              </div>
            ))}
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
              onClick={() => toggleItem(activeStore, item.id)}
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
