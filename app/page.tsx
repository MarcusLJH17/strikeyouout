'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Shuffle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DAILY_MATCHUP, MATCHUP_MODEL, type Pitch } from '@/lib/daily-matchup';
import { resolvePitch, type PitchHistoryEntry, type PitchResult } from '@/lib/game-engine';

type Count = { balls: number; strikes: number };
type Aim = { x: number; y: number };

const INITIAL_AIM = { x: 50, y: 50 };

export default function Home() {
  const [selectedPitch, setSelectedPitch] = useState<Pitch>(DAILY_MATCHUP.pitcher.pitches[0]);
  const [aim, setAim] = useState<Aim>(INITIAL_AIM);
  const [count, setCount] = useState<Count>({ balls: 0, strikes: 0 });
  const [result, setResult] = useState<PitchResult | null>(null);
  const [pitchNumber, setPitchNumber] = useState(1);
  const [plateAppearanceOver, setPlateAppearanceOver] = useState(false);
  const [history, setHistory] = useState<PitchHistoryEntry[]>([]);
  const targetRef = useRef<HTMLButtonElement>(null);

  const countLabel = useMemo(() => `${count.balls}–${count.strikes}`, [count]);

  useEffect(() => {
    function selectPitchWithKeyboard(event: KeyboardEvent) {
      if (event.code === 'Space' && plateAppearanceOver) {
        event.preventDefault();
        setCount({ balls: 0, strikes: 0 });
        setAim(INITIAL_AIM);
        setResult(null);
        setPitchNumber(1);
        setPlateAppearanceOver(false);
        setHistory([]);
        return;
      }

      const pitchIndex = Number(event.key) - 1;
      const pitch = DAILY_MATCHUP.pitcher.pitches[pitchIndex];
      if (!pitch || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      setSelectedPitch(pitch);
    }

    window.addEventListener('keydown', selectPitchWithKeyboard);
    return () => window.removeEventListener('keydown', selectPitchWithKeyboard);
  }, [plateAppearanceOver]);

  function updateAim(clientX: number, clientY: number) {
    const rect = targetRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAim({
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    });
  }

  function throwPitch() {
    if (plateAppearanceOver) return;
    const next = resolvePitch({ pitch: selectedPitch, target: aim, count, history });
    setResult(next);
    setHistory((previous) => [...previous, {
      pitchCode: next.pitchCode,
      actual: next.actual,
      velocity: next.velocity,
      outcome: next.outcome,
    }]);
    setPitchNumber((value) => value + 1);
    if (next.terminal) setPlateAppearanceOver(true);
    else setCount(next.count);
  }

  function resetPlateAppearance() {
    setCount({ balls: 0, strikes: 0 });
    setAim(INITIAL_AIM);
    setResult(null);
    setPitchNumber(1);
    setPlateAppearanceOver(false);
    setHistory([]);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="border-b border-white/8 bg-[#07111f]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full border border-red-400/40 bg-white text-[10px] font-black tracking-[-0.08em] text-red-700 shadow-[inset_0_0_0_3px_#f8f3e8]">SO</span>
            <div>
              <p className="font-heading text-lg font-extrabold uppercase tracking-[0.08em]">Strike You Out</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Daily matchup · Prototype</p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled className="border-white/10 bg-white/4 text-slate-400">
            <Shuffle aria-hidden="true" /> Shuffle soon
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8 sm:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">Today’s challenge</p>
            <h1 className="font-heading text-3xl font-black uppercase tracking-[-0.04em] sm:text-5xl">McLean <span className="font-normal text-slate-600">vs.</span> Ohtani</h1>
          </div>
          <div className="flex items-center gap-5 rounded-lg border border-white/8 bg-white/[0.035] px-4 py-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Count</p>
              <p className="font-mono text-2xl font-bold tabular-nums">{countLabel}</p>
            </div>
            <CountLights label="Balls" active={count.balls} total={3} color="bg-emerald-400" />
            <CountLights label="Strikes" active={count.strikes} total={2} color="bg-amber-300" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(480px,1fr)_250px]">
          <aside className="order-2 rounded-xl border border-white/8 bg-card/90 p-4 lg:order-1">
            <div className="mb-4 flex items-start justify-between border-b border-white/8 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">On the mound · RHP</p>
                <h2 className="mt-1 text-xl font-extrabold">Nolan McLean</h2>
              </div>
              <span className="rounded bg-blue-400/10 px-2 py-1 font-mono text-xs font-bold text-blue-300">#26</span>
            </div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Choose a pitch</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {DAILY_MATCHUP.pitcher.pitches.map((pitch, index) => {
                const active = selectedPitch.code === pitch.code;
                return (
                  <button
                    type="button"
                    key={pitch.code}
                    aria-pressed={active}
                    onClick={() => setSelectedPitch(pitch)}
                    className={`group rounded-lg border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${active ? 'border-red-400/70 bg-red-400/10 shadow-[inset_3px_0_0_#f24c54]' : 'border-white/8 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-extrabold">
                        <kbd className="grid size-5 place-items-center rounded border border-white/10 bg-black/20 font-mono text-[10px] text-slate-500">{index + 1}</kbd>
                        {pitch.shortName}
                      </span>
                      <span className="flex items-center gap-2">
                        <MovementArrow pitch={pitch} throws={DAILY_MATCHUP.pitcher.throws} />
                        <span className={`size-2 rounded-full ${pitch.color}`} />
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-400">{pitch.avgVelocity.toFixed(1)} avg · {pitch.maxVelocity.toFixed(1)} max</p>
                    <div className="mt-2 flex gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>{pitch.usage}% use</span><span>{pitch.whiff}% whiff</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {plateAppearanceOver && (
              <Button onClick={resetPlateAppearance} className="mt-3 w-full bg-red-500 text-white hover:bg-red-400">
                <RotateCcw aria-hidden="true" /> Face him again <kbd className="ml-auto rounded border border-white/20 bg-black/15 px-1.5 py-0.5 font-mono text-[9px] uppercase">Space</kbd>
              </Button>
            )}
          </aside>

          <section className="order-1 overflow-hidden rounded-xl border border-white/8 bg-[#0a1626] lg:order-2">
            <div className="min-h-[88px] border-b border-white/8 bg-black/15 px-4 py-4 text-center sm:px-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Pitch {result ? pitchNumber - 1 : pitchNumber}</p>
              <p aria-live="polite" className="mt-1 min-h-7 text-lg font-bold sm:text-xl">{result?.message ?? 'Choose a pitch. Aim at the plate. Then throw.'}</p>
              {result && <p className="mt-1 text-xs text-slate-500">Missed target by {result.missInches.toFixed(1)} in. · {result.factors.slice(0, 3).join(' · ')}</p>}
            </div>

            <div className="relative mx-auto aspect-[16/11] min-h-[410px] max-w-[850px] overflow-hidden bg-[#071a2d]">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%] bg-[linear-gradient(to_bottom,transparent_0%,rgba(133,83,48,.5)_30%,#70452b_100%)]" />
              <div className="pointer-events-none absolute bottom-[5%] left-1/2 h-5 w-7 -translate-x-1/2 bg-[#d6d4c7]/35 [clip-path:polygon(50%_0,100%_35%,82%_100%,18%_100%,0_35%)]" />

              <div className={`pointer-events-none absolute top-[28%] z-10 text-center opacity-70 ${DAILY_MATCHUP.batter.bats === 'L' ? 'left-[14%]' : 'right-[14%]'}`}>
                <div className="mx-auto size-11 rounded-full bg-black/55 shadow-[0_10px_30px_#000]" />
                <div className={`mt-[-2px] h-28 w-16 rounded-[45%_45%_24%_24%] bg-black/55 blur-[1px] ${DAILY_MATCHUP.batter.bats === 'L' ? '-rotate-6' : 'rotate-6'}`} />
                <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">{DAILY_MATCHUP.batter.bats}HB</p>
              </div>

              <button
                ref={targetRef}
                type="button"
                aria-label={`Aim ${selectedPitch.name} at ${Math.round(aim.x)} percent horizontal, ${Math.round(aim.y)} percent vertical`}
                onPointerMove={(event) => updateAim(event.clientX, event.clientY)}
                onPointerDown={(event) => { updateAim(event.clientX, event.clientY); event.currentTarget.setPointerCapture(event.pointerId); }}
                onPointerUp={throwPitch}
                disabled={plateAppearanceOver}
                className="absolute left-1/2 top-[16%] z-20 h-[70%] w-[54%] max-w-[440px] -translate-x-1/2 cursor-crosshair touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-default"
              >
                <span className="absolute left-[17%] top-[8%] h-[78%] w-[66%] border-2 border-[#d9e1df]/80 bg-white/[0.025] shadow-[0_0_25px_rgba(218,229,226,.08)]">
                  <span className="absolute inset-x-0 top-1/3 border-t border-white/15" /><span className="absolute inset-x-0 top-2/3 border-t border-white/15" />
                  <span className="absolute inset-y-0 left-1/3 border-l border-white/15" /><span className="absolute inset-y-0 left-2/3 border-l border-white/15" />
                </span>
                <span className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/20 shadow-[0_0_0_5px_rgba(255,255,255,.08),0_2px_12px_rgba(0,0,0,.5)]" style={{ left: `${aim.x}%`, top: `${aim.y}%` }}>
                  <span className="absolute left-[5px] top-[3px] h-[15px] w-[4px] rotate-[-18deg] rounded-full border-l border-red-300" />
                  <span className="absolute right-[5px] top-[3px] h-[15px] w-[4px] rotate-[18deg] rounded-full border-r border-red-300" />
                </span>
                {result && <span className={`pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-black/35 ${result.inZone ? 'bg-amber-300' : 'bg-red-400'}`} style={{ left: `${result.actual.x}%`, top: `${result.actual.y}%` }} />}
              </button>

              <div className={`pointer-events-none absolute bottom-[-20%] z-10 opacity-75 ${DAILY_MATCHUP.pitcher.throws === 'R' ? 'right-[2%]' : 'left-[2%]'}`}>
                <div className="ml-10 size-20 rounded-full bg-black shadow-[0_0_40px_#000]" />
                <div className={`mt-[-3px] h-48 w-40 rounded-[48%_48%_18%_18%] bg-black shadow-[0_0_50px_#000] ${DAILY_MATCHUP.pitcher.throws === 'R' ? 'rotate-6' : '-rotate-6'}`} />
              </div>
            </div>
          </section>

          <aside className="order-3 rounded-xl border border-white/8 bg-card/90 p-4">
            <div className="border-b border-white/8 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">At the plate · LHB</p>
              <h2 className="mt-1 text-xl font-extrabold">Shohei Ohtani</h2>
              <p className="mt-1 text-xs text-slate-500">2026 vs. RHP · {MATCHUP_MODEL.metadata.samplePitches.toLocaleString()} pitches</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-4 py-4">
              <Stat label="Zone swing" value={formatRate(MATCHUP_MODEL.zone.swing)} /><Stat label="Chase" value={formatRate(MATCHUP_MODEL.chase.swing)} />
              <Stat label="Zone contact" value={formatRate(MATCHUP_MODEL.zone.contact)} /><Stat label="Chase contact" value={formatRate(MATCHUP_MODEL.chase.contact)} />
            </dl>
            <div className="rounded-lg border border-blue-300/15 bg-blue-300/[0.06] p-3 text-xs leading-5 text-blue-100/65">Results adjust for count, pitch type, location hot zone, command, and the pitches already thrown in this at-bat.</div>
            <p className="mt-4 text-[10px] leading-4 text-slate-600">Data snapshot: Aug 30, 2026 · Source: Baseball Savant · Unofficial prototype</p>
          </aside>
        </div>
      </section>
    </main>
  );
}

function CountLights({ label, active, total, color }: { label: string; active: number; total: number; color: string }) {
  return <div><p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p><div className="flex gap-1.5">{Array.from({ length: total }, (_, index) => <span key={index} className={`size-2.5 rounded-full ${index < active ? color : 'bg-white/10'}`} />)}</div></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-600">{label}</dt><dd className="mt-0.5 font-mono text-lg font-bold text-slate-300">{value}</dd></div>;
}

function formatRate(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function MovementArrow({ pitch, throws }: { pitch: Pitch; throws: 'R' | 'L' }) {
  const mirrored = throws === 'L';
  const className = 'size-5 text-slate-400';
  if (pitch.movement === 'ride') return <ArrowUp aria-label="Riding movement" className={className} />;
  if (pitch.movement === 'arm-side-drop') return mirrored ? <ArrowDownLeft aria-label="Arm-side drop" className={className} /> : <ArrowDownRight aria-label="Arm-side drop" className={className} />;
  if (pitch.movement === 'glove-side-drop') return mirrored ? <ArrowDownRight aria-label="Glove-side drop" className={className} /> : <ArrowDownLeft aria-label="Glove-side drop" className={className} />;
  if (pitch.movement === 'glove-side-sweep') return mirrored ? <ArrowRight aria-label="Glove-side sweep" className={className} /> : <ArrowLeft aria-label="Glove-side sweep" className={className} />;
  return <ArrowDown aria-hidden="true" className={className} />;
}
