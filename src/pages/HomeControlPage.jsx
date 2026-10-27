import { useEffect, useState } from 'react';
import { initialRooms, scenes } from '../data/mockData';
import {
  getHomeAssistantSettings, isConfigured, fetchStates,
  toggleLight, setLightBrightness, setThermostatTemperature, setCoverPosition,
} from '../lib/homeAssistant';

// Polls slowly -- device state on a real smart home doesn't need
// second-by-second freshness, and this is one more thing not to hammer a
// Pi 3 with (see family-hub-project.md's T-10/Phase-4 notes on Pi 3
// performance headroom).
const LIVE_REFRESH_MS = 15 * 1000;

function entityName(entity) {
  return entity.attributes?.friendly_name || entity.entity_id;
}

// Groups the flat entity list Home Assistant's REST API returns into the
// three domains HomeControlPage understands how to control. Not every real
// device will fall into one of these -- anything else is simply not shown,
// same "only render what we know how to handle" reasoning as elsewhere in
// this app. No Areas/"room" grouping (HA's own concept for that) -- there's
// no live instance to confirm that's actually how Trey's devices end up
// organized, so this groups by domain instead, which the plain REST API
// gives for free.
function groupEntities(entities) {
  const lights = [];
  const climates = [];
  const covers = [];
  for (const entity of entities) {
    const domain = entity.entity_id.split('.')[0];
    if (domain === 'light' || domain === 'switch') lights.push(entity);
    else if (domain === 'climate') climates.push(entity);
    else if (domain === 'cover') covers.push(entity);
  }
  return { lights, climates, covers };
}

function LiveHomeControl({ haSettings, entities, onRefresh }) {
  const { lights, climates, covers } = groupEntities(entities);

  const handleToggleLight = async (entity) => {
    await toggleLight(haSettings, entity.entity_id, entity.state !== 'on');
    onRefresh();
  };

  const handleBrightness = async (entity, value) => {
    await setLightBrightness(haSettings, entity.entity_id, value);
    onRefresh();
  };

  const handleThermAdjust = async (entity, delta) => {
    const current = Number(entity.attributes?.temperature) || 70;
    await setThermostatTemperature(haSettings, entity.entity_id, current + delta);
    onRefresh();
  };

  const handleToggleCover = async (entity) => {
    await setCoverPosition(haSettings, entity.entity_id, entity.state !== 'open');
    onRefresh();
  };

  return (
    <div className="hc-rooms">
      {!!covers.length && (
        <div className="hc-room">
          <div className="hc-room-name">Garage & covers</div>
          <div className="hc-devices">
            {covers.map((entity) => (
              <div key={entity.entity_id} className={`hc-garage${entity.state === 'open' ? ' open' : ''}`} onClick={() => handleToggleCover(entity)}>
                <span className="hc-garage-icon">🚗</span>
                <div className="hc-garage-info">
                  <div className="hc-garage-name">{entityName(entity)}</div>
                  <div className="hc-garage-status">{entity.state === 'open' ? 'Open' : 'Closed'}</div>
                </div>
                <div className="hc-garage-btn">{entity.state === 'open' ? 'Close' : 'Open'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!lights.length && (
        <div className="hc-room">
          <div className="hc-room-name">Lights & switches</div>
          <div className="hc-devices">
            {lights.map((entity) => {
              const on = entity.state === 'on';
              const brightnessPct = entity.attributes?.brightness
                ? Math.round((entity.attributes.brightness / 255) * 100)
                : null;
              return (
                <div key={entity.entity_id}>
                  <div className={`hc-device${on ? ' on' : ''}`} onClick={() => handleToggleLight(entity)}>
                    <span className="hc-device-icon">💡</span>
                    <span className="hc-device-name">{entityName(entity)}</span>
                    <div className={`hc-toggle${on ? ' on' : ''}`} />
                  </div>
                  {brightnessPct !== null && (
                    <div className={`hc-dim-wrap${on ? ' show' : ''}`}>
                      <div className="hc-dim-label">
                        <span>Brightness</span><span>{brightnessPct}%</span>
                      </div>
                      <input
                        type="range"
                        className="hc-dim-slider"
                        min="0"
                        max="100"
                        value={brightnessPct}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleBrightness(entity, Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!!climates.length && (
        <div className="hc-room">
          <div className="hc-room-name">Climate</div>
          <div className="hc-devices">
            {climates.map((entity) => (
              <div className="hc-therm" key={entity.entity_id}>
                <span className="hc-therm-icon">🌡️</span>
                <div className="hc-therm-info">
                  <div className="hc-therm-name">{entityName(entity)}</div>
                  <div className="hc-therm-val">
                    Currently {entity.attributes?.current_temperature ?? '—'}° · Set to {entity.attributes?.temperature ?? '—'}°
                  </div>
                </div>
                <div className="hc-therm-btns">
                  <div className="hc-therm-btn" onClick={() => handleThermAdjust(entity, -1)}>−</div>
                  <div className="hc-therm-btn" onClick={() => handleThermAdjust(entity, 1)}>+</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!lights.length && !climates.length && !covers.length && (
        <div style={{ color: 'var(--text-muted)', padding: '1em' }}>
          Connected to Home Assistant, but no light, switch, climate, or cover entities were found.
        </div>
      )}
    </div>
  );
}

export default function HomeControlPage() {
  const [rooms, setRooms] = useState(initialRooms);
  const [activeScene, setActiveScene] = useState('normal');
  const [haSettings] = useState(() => getHomeAssistantSettings());
  const [liveEntities, setLiveEntities] = useState(null);
  const [liveError, setLiveError] = useState(null);

  const configured = isConfigured(haSettings);

  const refreshLive = () => {
    fetchStates(haSettings)
      .then((data) => { setLiveEntities(data); setLiveError(null); })
      .catch((err) => setLiveError(err.message));
  };

  useEffect(() => {
    if (!configured) return undefined;
    refreshLive();
    const id = setInterval(refreshLive, LIVE_REFRESH_MS);
    return () => clearInterval(id);
    // haSettings is read once on mount, same pattern as Sports -- a
    // Settings change takes effect on next visit to this page, which
    // remounts this component (see PAGES in App.jsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  const toggleDevice = (roomId, deviceId) => {
    setRooms((prev) => prev.map((room) => {
      if (room.id !== roomId) return room;
      return {
        ...room,
        devices: room.devices.map((d) => (d.id === deviceId ? { ...d, on: !d.on } : d)),
      };
    }));
  };

  const setBrightness = (roomId, deviceId, value) => {
    setRooms((prev) => prev.map((room) => {
      if (room.id !== roomId) return room;
      return {
        ...room,
        devices: room.devices.map((d) => (d.id === deviceId ? { ...d, brightness: value } : d)),
      };
    }));
  };

  const adjustTherm = (roomId, delta) => {
    setRooms((prev) => prev.map((room) => {
      if (room.id !== roomId || !room.thermostat) return room;
      const set = Math.min(85, Math.max(60, room.thermostat.set + delta));
      return { ...room, thermostat: { ...room.thermostat, set } };
    }));
  };

  const toggleGarage = (roomId) => {
    setRooms((prev) => prev.map((room) => {
      if (room.id !== roomId || !room.garage) return room;
      return { ...room, garage: { ...room.garage, open: !room.garage.open } };
    }));
  };

  const live = configured && !!liveEntities && !liveError;

  return (
    <div className="page active" id="page-home-control">
      {!live && (
        <div
          style={{
            margin: '0 0 0.6em', padding: '0.5em 0.8em', borderRadius: 'var(--card-radius)',
            background: 'var(--bg-card)', fontSize: '0.78em', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '0.5em',
          }}
        >
          <span>🔧</span>
          {!configured && (
            <span>Preview — these toggles don't control real devices yet. Add a Home Assistant URL and token in ⚙️ Settings once the Phase 4 Pi is set up.</span>
          )}
          {configured && !liveEntities && !liveError && <span>Connecting to Home Assistant…</span>}
          {configured && liveError && <span>Couldn't reach Home Assistant ({liveError}) — showing the preview instead.</span>}
        </div>
      )}

      {live ? (
        <LiveHomeControl haSettings={haSettings} entities={liveEntities} onRefresh={refreshLive} />
      ) : (
        <>
          <div className="hc-quickbar">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className={`hc-quick${activeScene === scene.id ? ' active' : ''}`}
                onClick={() => setActiveScene(scene.id)}
              >
                <span className="hc-quick-icon">{scene.icon}</span>
                <span className="hc-quick-label">{scene.label}</span>
              </div>
            ))}
          </div>

          <div className="hc-rooms">
            {rooms.map((room) => (
              <div className="hc-room" key={room.id}>
                <div className="hc-room-name">{room.name}</div>
                <div className="hc-devices">
                  {room.garage && (
                    <div className={`hc-garage${room.garage.open ? ' open' : ''}`} onClick={() => toggleGarage(room.id)}>
                      <span className="hc-garage-icon">🚗</span>
                      <div className="hc-garage-info">
                        <div className="hc-garage-name">{room.garage.name}</div>
                        <div className="hc-garage-status">{room.garage.open ? 'Open' : 'Closed'}</div>
                      </div>
                      <div className="hc-garage-btn">{room.garage.open ? 'Close' : 'Open'}</div>
                    </div>
                  )}

                  {room.devices.map((device) => (
                    <div key={device.id}>
                      <div
                        className={`hc-device${device.on ? ' on' : ''}`}
                        onClick={() => toggleDevice(room.id, device.id)}
                      >
                        <span className="hc-device-icon">{device.icon}</span>
                        <span className="hc-device-name">{device.name}</span>
                        <div className={`hc-toggle${device.on ? ' on' : ''}`} />
                      </div>
                      {device.dimmable && (
                        <div className={`hc-dim-wrap${device.on ? ' show' : ''}`}>
                          <div className="hc-dim-label">
                            <span>Brightness</span><span>{device.brightness}%</span>
                          </div>
                          <input
                            type="range"
                            className="hc-dim-slider"
                            min="0"
                            max="100"
                            value={device.brightness}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setBrightness(room.id, device.id, Number(e.target.value))}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {room.thermostat && (
                    <div className="hc-therm">
                      <span className="hc-therm-icon">🌡️</span>
                      <div className="hc-therm-info">
                        <div className="hc-therm-name">Thermostat</div>
                        <div className="hc-therm-val">Currently {room.thermostat.current}° · Set to {room.thermostat.set}°</div>
                      </div>
                      <div className="hc-therm-btns">
                        <div className="hc-therm-btn" onClick={() => adjustTherm(room.id, -1)}>−</div>
                        <div className="hc-therm-btn" onClick={() => adjustTherm(room.id, 1)}>+</div>
                      </div>
                    </div>
                  )}

                  {room.cameras && room.cameras.map((cam) => (
                    <div className="hc-cam" key={cam.id}>
                      <span className="hc-cam-icon">📹</span>
                      <span className="hc-cam-name">{cam.name}</span>
                      <span className="hc-cam-badge">Live</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
