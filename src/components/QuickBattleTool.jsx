import { useState, useEffect, useRef } from 'react';
import {
  Timer, Heart, Play, Pause, RotateCcw, Plus, Minus, X,
  Settings, Zap
} from 'lucide-react';

/**
 * QuickBattleTool: standalone timer + team life counters with no session/database state.
 * Used for impromptu fights where you just want a count and a clock.
 *
 * Renders as a full-screen overlay when `open` is true.
 * Persists the last-used config to localStorage.
 */

const STORAGE_KEY = 'thepark_quickbattle_v1';

const DEFAULT_CONFIG = {
  teamCount: 2,
  livesPerTeam: 5,
  timerMode: 'countdown', // 'none' | 'countup' | 'countdown'
  timerSeconds: 180
};

export default function QuickBattleTool({ open, onClose }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [phase, setPhase] = useState('setup'); // 'setup' | 'live'
  const [lives, setLives] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [alarmed, setAlarmed] = useState(false);
  const intervalRef = useRef(null);

  // Restore last config on open
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
    } catch {}
    setPhase('setup');
    setElapsed(0);
    setRunning(false);
    setAlarmed(false);
  }, [open]);

  // Timer tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // Countdown alarm
  useEffect(() => {
    if (config.timerMode === 'countdown' && !alarmed && elapsed >= config.timerSeconds && config.timerSeconds > 0 && phase === 'live') {
      setAlarmed(true);
      setRunning(false);
      playAlarm();
    }
  }, [elapsed, config, alarmed, phase]);

  function playAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.4, 0.8].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      });
    } catch {}
  }

  function start() {
    // Save config for next time
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
    // Initialize life pool
    const initLives = Array.from({ length: config.teamCount }, () => config.livesPerTeam);
    setLives(initLives);
    setElapsed(0);
    setRunning(false);
    setAlarmed(false);
    setPhase('live');
  }

  function reset() {
    setRunning(false);
    setElapsed(0);
    setAlarmed(false);
    setLives(Array.from({ length: config.teamCount }, () => config.livesPerTeam));
  }

  function adjustLives(idx, delta) {
    setLives((prev) => {
      const next = [...prev];
      next[idx] = Math.max(0, next[idx] + delta);
      return next;
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-cream-50 z-50 flex flex-col">
      <header className="border-b border-grass-100 bg-white flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-grass-500 to-grass-700 flex items-center justify-center">
            <Zap className="w-5 h-5 text-cream-50" />
          </div>
          <div>
            <h2 className="font-display text-lg leading-none">Quick Battle</h2>
            <p className="text-xs text-ink-700/50">Standalone timer & life counter — nothing is saved</p>
          </div>
        </div>
        <div className="flex gap-2">
          {phase === 'live' && (
            <button onClick={() => setPhase('setup')} className="btn-ghost text-sm">
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {phase === 'setup' ? (
          <SetupView config={config} setConfig={setConfig} onStart={start} />
        ) : (
          <LiveView
            config={config}
            lives={lives}
            elapsed={elapsed}
            running={running}
            alarmed={alarmed}
            onAdjustLives={adjustLives}
            onToggleRun={() => setRunning((r) => !r)}
            onReset={reset}
          />
        )}
      </main>
    </div>
  );
}

// === SETUP VIEW ===

function SetupView({ config, setConfig, onStart }) {
  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));
  const useTimer = config.timerMode !== 'none';
  const useLives = config.livesPerTeam > 0;

  return (
    <div className="max-w-md mx-auto space-y-5 py-4">
      {/* Teams */}
      <div className="card p-4">
        <label className="label">Number of Teams</label>
        <div className="grid grid-cols-5 gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => set('teamCount', n)}
              className={`py-3 rounded-lg font-display text-lg border-2 transition ${
                config.teamCount === n
                  ? 'bg-grass-500 border-grass-600 text-white'
                  : 'bg-white border-grass-200 text-ink-700 hover:border-grass-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Lives */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="label flex items-center gap-2 mb-0">
            <Heart className="w-4 h-4 text-sun-600" /> Lives per team
          </label>
          <span className="font-display text-2xl tabular-nums">
            {config.livesPerTeam || '∞'}
          </span>
        </div>
        <input
          type="range" min="0" max="20" step="1"
          value={config.livesPerTeam}
          onChange={(e) => set('livesPerTeam', Number(e.target.value))}
          className="w-full accent-grass-600"
        />
        <p className="text-xs text-ink-700/50">
          {config.livesPerTeam === 0
            ? 'No life pool — manual tracking only.'
            : `Each team starts with ${config.livesPerTeam} lives.`}
        </p>
      </div>

      {/* Timer */}
      <div className="card p-4 space-y-3">
        <label className="label flex items-center gap-2 mb-0">
          <Timer className="w-4 h-4 text-sky-600" /> Timer
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'none', label: 'Off' },
            { id: 'countup', label: 'Stopwatch' },
            { id: 'countdown', label: 'Countdown' }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => set('timerMode', opt.id)}
              className={`py-2.5 rounded-lg font-semibold text-sm border-2 transition ${
                config.timerMode === opt.id
                  ? 'bg-sky-500 border-sky-600 text-white'
                  : 'bg-white border-grass-200 text-ink-700 hover:border-grass-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {config.timerMode === 'countdown' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-700/60">Duration</span>
              <span className="font-display text-xl tabular-nums">
                {formatSeconds(config.timerSeconds)}
              </span>
            </div>
            <input
              type="range" min="30" max="900" step="30"
              value={config.timerSeconds}
              onChange={(e) => set('timerSeconds', Number(e.target.value))}
              className="w-full accent-sky-600"
            />
            <div className="flex justify-between gap-1 mt-2">
              {[60, 120, 180, 300, 600].map((s) => (
                <button
                  key={s}
                  onClick={() => set('timerSeconds', s)}
                  className="text-xs px-2 py-1 rounded border border-grass-200 hover:bg-cream-100"
                >
                  {formatSeconds(s)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!useTimer && !useLives && (
        <p className="text-xs text-center text-sun-600">
          Both timer and lives are off — there's not much to track. Enable at least one above.
        </p>
      )}

      <button
        onClick={onStart}
        disabled={!useTimer && !useLives}
        className="btn-primary w-full justify-center text-base py-3 disabled:opacity-40"
      >
        <Play className="w-5 h-5" /> Start
      </button>
    </div>
  );
}

// === LIVE VIEW ===

function LiveView({ config, lives, elapsed, running, alarmed, onAdjustLives, onToggleRun, onReset }) {
  const useTimer = config.timerMode !== 'none';
  const useLives = config.livesPerTeam > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {useTimer && (
        <TimerPanel config={config} elapsed={elapsed} running={running} alarmed={alarmed} onToggle={onToggleRun} />
      )}

      {useLives && (
        <div>
          <h3 className="text-sm font-semibold text-ink-700/70 uppercase tracking-wide mb-2 text-center">
            Team Lives
          </h3>
          <div className={`grid gap-3 ${
            lives.length === 2 ? 'grid-cols-2' :
            lives.length === 3 ? 'grid-cols-3' :
            lives.length === 4 ? 'grid-cols-2 sm:grid-cols-4' :
            'grid-cols-2 sm:grid-cols-3'
          }`}>
            {lives.map((count, idx) => {
              const dead = count === 0;
              return (
                <div key={idx} className={`rounded-2xl p-4 border-2 ${
                  dead ? 'bg-ink-700/10 border-ink-700/20' : 'bg-white border-grass-200 shadow-sm'
                }`}>
                  <div className={`text-center text-sm font-semibold mb-2 ${
                    dead ? 'text-ink-700/40 line-through' : 'text-grass-700'
                  }`}>
                    Team {idx + 1}
                  </div>
                  <div className={`text-center font-display text-6xl sm:text-7xl tabular-nums leading-none mb-3 ${
                    dead ? 'text-ink-700/30' : 'text-ink-900'
                  }`}>
                    {count}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onAdjustLives(idx, -1)}
                      disabled={dead}
                      className="w-12 h-12 rounded-xl bg-sun-500 hover:bg-sun-400 text-white flex items-center justify-center disabled:opacity-30 transition shadow-sm active:scale-95"
                      title="Death"
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => onAdjustLives(idx, 1)}
                      className="w-12 h-12 rounded-xl bg-grass-100 hover:bg-grass-200 text-grass-700 flex items-center justify-center transition active:scale-95"
                      title="Add a life / undo"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button onClick={onReset} className="btn-ghost text-sm">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
}

function TimerPanel({ config, elapsed, running, alarmed, onToggle }) {
  const display = config.timerMode === 'countdown'
    ? Math.max(0, config.timerSeconds - elapsed)
    : elapsed;
  const m = Math.floor(display / 60);
  const s = display % 60;
  const isFinished = config.timerMode === 'countdown' && elapsed >= config.timerSeconds;

  return (
    <div className="card p-6 bg-gradient-to-br from-grass-50 to-cream-50 border-grass-200">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Timer className="w-4 h-4 text-grass-700" />
        <span className="text-sm font-semibold text-ink-700/70">
          {config.timerMode === 'countdown' ? 'Time Remaining' : 'Time Elapsed'}
        </span>
      </div>
      <div className={`font-display text-7xl sm:text-8xl text-center tabular-nums leading-none mb-4 ${
        isFinished ? 'text-sun-600 animate-pulse' : 'text-ink-900'
      }`}>
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </div>
      <div className="flex items-center justify-center">
        <button
          onClick={onToggle}
          disabled={isFinished}
          className={`px-8 py-3 rounded-xl font-semibold text-base transition shadow-sm flex items-center gap-2 ${
            running
              ? 'bg-cream-200 text-ink-700 hover:bg-cream-100'
              : 'bg-grass-500 hover:bg-grass-600 text-white disabled:opacity-40'
          }`}
        >
          {running ? <><Pause className="w-5 h-5" /> Pause</> : <><Play className="w-5 h-5" /> {elapsed === 0 ? 'Start' : 'Resume'}</>}
        </button>
      </div>
    </div>
  );
}

// === HELPERS ===

function formatSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}
