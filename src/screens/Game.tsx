import { useEffect, useMemo, useRef, useState } from 'react';
import { send } from '../socket';
import type { GameView, PublicPlayer } from '../types';
import type { Notify } from '../App';
import { NIGHT_STEP_TEXT, PHASE_LABEL, ROLE_INFO } from '../roles';

type Props = { view: GameView; notify: Notify; onLeave: () => void };
type Call = (event: string, ...args: unknown[]) => Promise<void>;

/** 게임 중 화면 꺼짐 방지 + 단계 바뀔 때 진동 */
function usePhaseEffects(key: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    navigator.vibrate?.(150);
  }, [key]);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request('screen');
      } catch {
        /* 지원 안 함 */
      }
    };
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}

export default function Game({ view, notify, onLeave }: Props) {
  const { phase, me } = view;
  const [popupSeen, setPopupSeen] = useState<number | null>(null);
  const [showRole, setShowRole] = useState(true);
  const [threatSeenDay, setThreatSeenDay] = useState<number | null>(null);
  usePhaseEffects(`${phase}-${view.night?.index}`);
  useEffect(() => {
    if (phase === 'intro') { setPopupSeen(null); setThreatSeenDay(null); }
  }, [phase]);

  const byId = useMemo(() => Object.fromEntries(view.players.map((p) => [p.id, p])), [view.players]);
  const role = me.role ? ROLE_INFO[me.role] : null;
  const isMafiaTeam = me.role === 'mafia' || me.role === 'spy';

  const call: Call = async (event, ...args) => {
    const res = await send(event, ...args);
    if (!res.ok) notify(res.error!);
  };

  const stopGame = () => {
    if (confirm('게임을 중단하고 대기실로 돌아갈까요?')) call('game:lobby');
  };

  return (
    <main className="screen game">
      <header className="topbar">
        <div>
          <div className="phase-name">{PHASE_LABEL[phase]}</div>
          {phase !== 'ended' && <div className="muted small">{view.day}일차</div>}
        </div>
        <div className="topbar-actions">
          {me.isHost && phase !== 'ended' && (
            <button className="link small" onClick={stopGame}>
              중단
            </button>
          )}
          <button className="link small" onClick={() => confirm('방에서 나갈까요?') && onLeave()}>
            나가기
          </button>
        </div>
      </header>

      {role && (
        <button className={`role-card ${isMafiaTeam ? 'mafia' : ''}`} onClick={() => setShowRole(!showRole)}>
          {showRole ? (
            <>
              <div className="role-emoji">{role.emoji}</div>
              <div>
                <div className="role-name">
                  {role.name} <span className="team">{role.team}</span>
                </div>
                <div className="role-desc">{role.desc}</div>
              </div>
            </>
          ) : (
            <div className="role-hidden">🔒 탭해서 내 직업 보기</div>
          )}
        </button>
      )}

      {!me.alive && phase !== 'ended' && <div className="banner dead">☠️ 사망했습니다. 관전 중입니다.</div>}

      <section className="card action">
        <PhasePanel view={view} byId={byId} call={call} />
        {me.isHost && ['day', 'vote', 'voteResult', 'defense', 'final', 'execution'].includes(phase) && (
          <button className="btn primary" onClick={() => call('host:next')}>
            {phase === 'day' ? '투표 시작' : phase === 'vote' ? '투표 종료' : phase === 'defense' ? '찬반 투표 시작' : phase === 'final' ? '찬반 투표 종료' : '다음'}
          </button>
        )}
        {me.isHost && (phase === 'night' || phase === 'intro') && (
          <button className="btn" onClick={() => confirm('이 차례를 건너뛸까요? 미완료 능력은 실행되지 않습니다.') && call('night:skip')}>차례 건너뛰기</button>
        )}
      </section>

      <section className="card feed">
        <h2>게임 기록</h2>
        <LogList view={view} />
      </section>

      {view.popup && popupSeen !== view.popup.id && (
        <div className="modal-backdrop"><div className="modal">
          <h3>능력 결과</h3><p>{view.popup.text}</p>
          <button className="btn primary" onClick={() => setPopupSeen(view.popup!.id)}>확인</button>
        </div></div>
      )}
      {view.threatened && threatSeenDay !== view.day && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-emoji">😠</div>
            <h3>깡패에게 지목당했습니다!</h3>
            <ul>
              <li>오늘 하루 아무 말도 할 수 없습니다.</li>
              <li>투표는 할 수 있지만 무효표로 처리됩니다.</li>
              <li>오늘 밤 능력을 사용할 수 없습니다.</li>
            </ul>
            <p className="muted small">다른 사람에게 들키지 않도록 평소처럼 행동하세요.</p>
            <button className="btn primary" onClick={() => setThreatSeenDay(view.day)}>
              확인
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────

type PanelProps = { view: GameView; byId: Record<string, PublicPlayer>; call: Call };

function NightPanel({ view, byId, call }: PanelProps) {
  const n = view.night;
  // 두 번째 '다음' 활성화 시각 (서버가 정한 1~5초 무작위 대기)
  const [readyAt, setReadyAt] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (n?.tapReadyInMs == null) return;
    const at = Date.now() + n.tapReadyInMs;
    setReadyAt(at);
    const t = window.setTimeout(() => setTick((x) => x + 1), n.tapReadyInMs + 50);
    return () => window.clearTimeout(t);
  }, [n?.tapReadyInMs, n?.index, view.day]);
  if (!n) return null;

  const header = (
    <>
      <h3>{NIGHT_STEP_TEXT[n.step].text}</h3>
      <p className="muted">밤 차례 {n.index + 1} / {n.count}</p>
    </>
  );

  // 사망자: 밤에는 아무것도 누르지 않음
  if (n.status === 'dead') {
    return (
      <>
        {header}
        <p className="hint">사망하여 밤에는 참여하지 않습니다. 화면만 지켜보세요.</p>
        <Grid players={view.players} meId={view.me.id} />
      </>
    );
  }

  // 능력 사용자: 대상 선택 → 다음 (총 2번)
  if (n.status === 'pick') {
    return (
      <>
        {header}
        <p className="hint">대상을 선택한 뒤 다음을 누르세요.{n.team.length > 0 && ' 동료 모두 같은 대상을 선택해야 합니다.'}</p>
        {n.team.map((t) => (
          <p key={t.id} className="small">
            {t.name}: {t.pick ? byId[t.pick]?.name : '선택 중'} {t.confirmed ? '· 다음 완료' : ''}
          </p>
        ))}
        <Grid
          players={view.players}
          meId={view.me.id}
          selected={n.myPick}
          selectable={(p) =>
            p.alive &&
            p.id !== n.blockedTarget &&
            (n.step === 'doctor' || (n.step === 'mafia' ? p.role !== 'mafia' && p.role !== 'spy' : p.role !== n.step))
          }
          onSelect={(p) => call('night:pick', p.id)}
        />
        {n.blockedTarget && <p className="hint">어젯밤 치료한 {byId[n.blockedTarget]?.name}님은 오늘 치료할 수 없습니다.</p>}
        <button className="btn primary night-next" disabled={!n.canNext} onClick={() => call('night:next')}>
          {n.done ? '다른 사람을 기다리는 중' : '다음'}
        </button>
      </>
    );
  }

  // 그 외 생존자: 직업을 숨기기 위해 '다음'을 두 번 (두 번째는 1~5초 뒤 활성화)
  const note =
    n.status === 'blocked'
      ? '깡패에게 협박당해 오늘 밤 능력을 사용할 수 없습니다.'
      : n.status === 'contacted'
        ? '이미 접선했습니다. 마피아 차례에 함께 고르세요.'
        : `${ROLE_INFO[n.step].name} 직업이 사람을 선택하고 있습니다.`;
  const waiting = n.taps === 1 && Date.now() < readyAt;
  return (
    <>
      {header}
      <p className="hint">{note}</p>
      <p className="hint">
        {n.taps === 0 ? '다음을 눌러주세요.' : n.taps === 1 ? '버튼이 다시 켜지면 한 번 더 눌러주세요.' : '완료했습니다. 다른 사람을 기다리는 중입니다.'}
      </p>
      <Grid players={view.players} meId={view.me.id} />
      <button className="btn primary night-next" disabled={!n.canNext || waiting} onClick={() => call('night:next')}>
        {n.done ? '다른 사람을 기다리는 중' : waiting ? '잠시만 기다리세요…' : '다음'}
      </button>
    </>
  );
}

function VoteResultPanel({ view, byId }: Omit<PanelProps, 'call'>) {
  const r = view.voteResult;
  if (!r) return null;
  const rows = Object.entries(r.counts).sort((a, b) => b[1] - a[1]);
  const outcome =
    r.reason === 'ok'
      ? `📢 ${byId[r.accusedId!]?.name}님이 최후의 반론을 합니다.`
      : r.reason === 'tie'
        ? '최다 득표가 동률이라 투표가 무효입니다. 밤이 됩니다.'
        : r.reason === 'notEnough'
          ? `최다 득표가 생존자 절반(${r.threshold}표)에 못 미쳐 투표가 무효입니다. 밤이 됩니다.`
          : '유효표가 없어 투표가 무효입니다. 밤이 됩니다.';
  return (
    <>
      <h3>🗳 투표 결과</h3>
      <ul className="tally">
        {rows.length === 0 && <li className="muted">득표한 사람이 없습니다.</li>}
        {rows.map(([id, n]) => (
          <li key={id} className={id === r.accusedId ? 'top' : ''}>
            <span>{byId[id]?.name}</span>
            <b>{n}표</b>
          </li>
        ))}
      </ul>
      <p className="muted small">지목되려면 생존자 절반 이상인 {r.threshold}표가 필요합니다.</p>
      <p className={`announce ${r.reason === 'ok' ? '' : 'invalid'}`}>{outcome}</p>
    </>
  );
}

function PhasePanel({ view, byId, call }: PanelProps) {
  const { phase, me } = view;
  const accused = view.accusedId ? byId[view.accusedId] : undefined;
  const aliveCount = view.players.filter((p) => p.alive).length;

  if (phase === 'intro') return <>
    <h3>첫날 밤 · 직업과 동료 확인</h3>
    <p>오늘 밤에는 능력을 사용하지 않습니다. 같은 직업의 동료를 확인하고 다음을 누르세요. 모두 누르면 둘째 날 낮이 됩니다.</p>
    <Grid players={view.players} meId={me.id} />
    <button className="btn primary" disabled={view.introConfirmed} onClick={() => call('night:next')}>{view.introConfirmed ? '다른 사람의 확인을 기다리는 중' : '다음 · 확인 완료'}</button>
  </>;

  if (phase === 'night') return <NightPanel view={view} byId={byId} call={call} />;

  if (phase === 'day') {
    const morning = view.log.filter((l) => l.day === view.day && (l.kind === 'death' || l.kind === 'save'));
    return (
      <>
        <h3>☀️ 토론 시간</h3>
        {morning.length > 0 ? (
          morning.map((l) => (
            <p key={l.id} className={`announce ${l.kind}`}>
              {l.text}
            </p>
          ))
        ) : (
          <p className="announce">지난 밤 아무도 죽지 않았습니다.</p>
        )}
        <Grid players={view.players} meId={me.id} />
      </>
    );
  }

  if (phase === 'vote') {
    return (
      <>
        <h3>🗳 최후의 반론을 할 사람을 지목하세요</h3>
        <p className="hint">
          투표 {view.votedCount}/{view.voterCount}명 완료 · 생존자 절반 이상({Math.ceil(aliveCount / 2)}표)을 받아야 지목됩니다.
          {me.role === 'politician' && ' 당신의 표는 2표입니다.'}
        </p>
        {view.canVote ? (
          <>
            <Grid
              players={view.players}
              meId={me.id}
              selectable={(p) => p.alive}
              selected={view.myVote ?? null}
              onSelect={(p) => call('vote:cast', p.id)}
            />
            <button className={`btn abstain ${view.myVote === null ? 'selected' : ''}`} onClick={() => call('vote:cast', null)}>
              기권
            </button>
          </>
        ) : (
          <Grid players={view.players} meId={me.id} />
        )}
      </>
    );
  }

  if (phase === 'voteResult') return <VoteResultPanel view={view} byId={byId} />;

  if (phase === 'defense') {
    const isMe = accused?.id === me.id;
    return (
      <div className="center-block">
        <h3>📢 최후의 반론</h3>
        <div className="accused">{accused?.name}</div>
        <p className="muted">{isMe ? '당신이 지목되었습니다. 변론하세요!' : '지목된 사람의 변론을 들어보세요.'}</p>
      </div>
    );
  }

  if (phase === 'final') {
    const canFinal = view.canVote && accused?.id !== me.id;
    return (
      <div className="center-block">
        <h3>⚖️ 찬반 투표</h3>
        <div className="accused">{accused?.name}</div>
        <p className="muted">
          처형에 찬성하십니까? ({view.votedCount}/{view.voterCount}명 투표)
        </p>
        {canFinal ? (
          <div className="row">
            <button className={`btn vote-yes ${view.myFinal === true ? 'selected' : ''}`} onClick={() => call('final:cast', true)}>
              👍 찬성
            </button>
            <button className={`btn vote-no ${view.myFinal === false ? 'selected' : ''}`} onClick={() => call('final:cast', false)}>
              👎 반대
            </button>
          </div>
        ) : (
          <p className="muted">투표할 수 없습니다.</p>
        )}
      </div>
    );
  }

  if (phase === 'execution') {
    const last = [...view.log].reverse().find((l) => l.kind === 'death' || l.kind === 'save' || l.kind === 'vote');
    return (
      <div className="center-block">
        <h3>처형 결과</h3>
        <p className={`announce big ${last?.kind ?? ''}`}>{last?.text}</p>
        <p className="muted">방장이 다음을 누르면 진행합니다.</p>
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <>
        <div className={`winner ${view.winner}`}>{view.winner === 'mafia' ? '🩸 마피아 승리' : '🎉 시민 승리'}</div>
        <h3>직업 공개</h3>
        <Grid players={view.players} meId={me.id} />
        {me.isHost ? (
          <div className="row">
            <button className="btn" onClick={() => call('game:lobby')}>
              대기실로
            </button>
            <button className="btn primary" onClick={() => call('game:start')}>
              다시 시작
            </button>
          </div>
        ) : (
          <p className="muted center">방장이 다음 게임을 준비 중입니다.</p>
        )}
      </>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────

type GridProps = {
  players: PublicPlayer[];
  meId: string;
  selectable?: (p: PublicPlayer) => boolean;
  selected?: string | null;
  onSelect?: (p: PublicPlayer) => void;
};

function Grid({ players, meId, selectable, selected, onSelect }: GridProps) {
  return (
    <div className="grid">
      {players.map((p) => {
        const can = !!selectable?.(p);
        const roleInfo = p.role ? ROLE_INFO[p.role] : null;
        return (
          <button
            key={p.id}
            className={[
              'pcell',
              !p.alive && 'dead',
              can && 'can',
              selected === p.id && 'selected',
              (p.role === 'mafia' || (p.role === 'spy' && p.id !== meId)) && 'is-mafia',
              !p.connected && 'offline',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={!can}
            onClick={() => can && onSelect?.(p)}
          >
            <span className="pname">
              {p.isHost && '👑'}
              {p.name}
            </span>
            <span className="psub">
              {!p.alive ? '사망' : p.id === meId ? '나' : !p.connected ? '연결 끊김' : ''}
              {roleInfo && p.id !== meId ? ` ${roleInfo.emoji}${roleInfo.name}` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LogList({ view }: { view: GameView }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [view.log.length]);
  return (
    <div className="scroll" ref={ref}>
      {view.log.map((l) => (
        <p key={l.id} className={`log ${l.kind}`}>
          {(l.kind === 'private' || l.kind === 'result') && <span className="tag">나만 보임</span>}
          {l.text}
        </p>
      ))}
    </div>
  );
}
