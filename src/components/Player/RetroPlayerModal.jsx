import React, { useEffect, useState } from 'react';
import {
  REPRODUCTOR_TRACKS,
  getMusicState,
  setMusicVolume,
  startTrackLoop,
  stopTrackLoop,
  subscribeMusicState,
} from '../../services/soundEngine';

export default function RetroPlayerModal({ onClose, onApplySongStatus }) {
  const [player, setPlayer] = useState(() => getMusicState());

  useEffect(() => {
    const unsub = subscribeMusicState(setPlayer);
    return () => unsub();
  }, []);

  const currentTrack = player.track || REPRODUCTOR_TRACKS[player.trackIndex] || REPRODUCTOR_TRACKS[0];

  const handleTogglePlay = () => {
    if (player.isPlaying) {
      stopTrackLoop();
    } else {
      startTrackLoop(player.trackIndex);
    }
  };

  const handleSelectTrack = (idx) => {
    startTrackLoop(idx);
  };

  const handlePrev = () => {
    const nextIdx = (player.trackIndex - 1 + REPRODUCTOR_TRACKS.length) % REPRODUCTOR_TRACKS.length;
    startTrackLoop(nextIdx);
  };

  const handleNext = () => {
    const nextIdx = (player.trackIndex + 1) % REPRODUCTOR_TRACKS.length;
    startTrackLoop(nextIdx);
  };

  return (
    <div className="z05-modal-overlay" onClick={onClose}>
      <div className="xp-window z05-modal-card z05-player-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="xp-titlebar">
          <div className="xp-titlebar-title">
            <span style={{ fontSize: 15 }}>🎧</span>
            <span>Reproductor 05 — Estilo Clásico</span>
          </div>
          <div className="xp-titlebar-controls">
            <button type="button" className="xp-btn-control xp-btn-close" onClick={onClose} title="Cerrar">✕</button>
          </div>
        </div>

        <div className="xp-window-body z05-player-body">
          {/* WMP-style dark metallic screen + equalizer */}
          <div className="z05-player-screen">
            <div className="z05-player-eq" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, idx) => {
                const active = player.isPlaying;
                const heightPct = active
                  ? 25 + (((player.step * 23 + idx * 17) % 70))
                  : 16;
                return (
                  <span
                    key={idx}
                    className={`z05-player-eq-bar ${active ? 'is-playing' : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
            </div>
            <div className="z05-player-track-meta">
              <div className="z05-player-track-title">
                {player.isPlaying ? '▶ ' : '⏸ '}
                {currentTrack.title}
              </div>
              <div className="z05-player-track-artist">
                {currentTrack.artist} • {currentTrack.bpm} BPM • Synth 2005
              </div>
            </div>
          </div>

          {/* Transport controls & Volume */}
          <div className="z05-player-controls">
            <div className="z05-player-buttons">
              <button type="button" className="xp-btn" onClick={handlePrev} title="Anterior">⏮</button>
              <button type="button" className="xp-btn xp-btn-primary" onClick={handleTogglePlay} style={{ minWidth: 92 }}>
                {player.isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
              </button>
              <button type="button" className="xp-btn" onClick={handleNext} title="Siguiente">⏭</button>
              <button type="button" className="xp-btn" onClick={stopTrackLoop} title="Detener">⏹</button>
            </div>

            <label className="z05-player-volume">
              <span title="Volumen">🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={player.volume}
                onChange={(e) => setMusicVolume(e.target.value)}
              />
            </label>
          </div>

          {/* Playlist */}
          <div className="z05-player-playlist">
            {REPRODUCTOR_TRACKS.map((track, idx) => {
              const isCurrent = idx === player.trackIndex;
              return (
                <button
                  key={track.id}
                  type="button"
                  className={`z05-player-track-row ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => handleSelectTrack(idx)}
                >
                  <span>{isCurrent && player.isPlaying ? '🔊' : '🎵'} {idx + 1}. {track.title}</span>
                  <span className="z05-player-track-sub">{track.artist}</span>
                </button>
              );
            })}
          </div>

          <div className="z05-player-footer">
            <button
              type="button"
              className="xp-btn xp-btn-primary"
              onClick={() => onApplySongStatus?.(`(8) ${currentTrack.statusText}`)}
            >
              🎵 Poner en mi estado (8)
            </button>
            <button type="button" className="xp-btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
