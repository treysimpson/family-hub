import { useState } from 'react';
import { initialRooms, scenes } from '../data/mockData';

export default function HomeControlPage() {
  const [rooms, setRooms] = useState(initialRooms);
  const [activeScene, setActiveScene] = useState('normal');

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

  return (
    <div className="page active" id="page-home-control">
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
    </div>
  );
}
