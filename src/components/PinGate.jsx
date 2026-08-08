import { useState } from 'react';

// A casual-viewer deterrent for a shared wall display, not real security: the
// PIN lives in localStorage and this file is in a public repo, so anyone
// determined to read the source can find it. Good enough to stop a kid from
// idly scrolling into the budget page, not a defense against an attacker.
const STORAGE_KEY = 'fh-budget-pin';

export default function PinGate({ onUnlock }) {
  const [hasPin] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const createPin = () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    localStorage.setItem(STORAGE_KEY, pin);
    onUnlock();
  };

  const checkPin = () => {
    if (pin === localStorage.getItem(STORAGE_KEY)) {
      onUnlock();
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  return (
    <div className="page active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6em', alignItems: 'center', maxWidth: '20em' }}>
        <div style={{ fontSize: '1.4em' }}>🔒</div>
        <div className="fp-title">{hasPin ? 'Enter PIN' : 'Set a Budget PIN'}</div>
        {!hasPin && (
          <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', textAlign: 'center' }}>
            This protects the Budget section from casual viewing on the wall display.
          </div>
        )}
        <input
          className="add-input"
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && (hasPin ? checkPin() : confirmPin && createPin())}
          style={{ textAlign: 'center', width: '8em' }}
          autoFocus
        />
        {!hasPin && (
          <input
            className="add-input"
            type="password"
            inputMode="numeric"
            placeholder="Confirm PIN"
            value={confirmPin}
            onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && createPin()}
            style={{ textAlign: 'center', width: '8em' }}
          />
        )}
        {error && <div style={{ fontSize: '0.78em', color: 'var(--ev-coral-tx)' }}>{error}</div>}
        <button className="add-btn" onClick={hasPin ? checkPin : createPin}>
          {hasPin ? 'Unlock' : 'Set PIN'}
        </button>
      </div>
    </div>
  );
}

export function hasBudgetPin() {
  return !!localStorage.getItem(STORAGE_KEY);
}

export function resetBudgetPin() {
  localStorage.removeItem(STORAGE_KEY);
}
