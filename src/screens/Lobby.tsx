import { send } from '../socket';
import type { GameView, Settings } from '../types';
import type { Notify } from '../App';
import { citizenCount, MAX_PLAYERS, ROLE_INFO, validateRoles } from '../roles';

type Props = { view: GameView; notify: Notify; onLeave: () => void };

const ROLE_KEYS = ['mafia', 'spy', 'police', 'doctor', 'politician', 'gangster'] as const;
export default function Lobby({ view, notify, onLeave }: Props) {
  const isHost = view.me.isHost;
  const s = view.settings;
  const n = view.players.length;
  const error = validateRoles(s, n);

  const change = async (key: keyof Settings, delta: number) => {
    const res = await send('room:settings', { [key]: s[key] + delta });
    if (!res.ok) notify(res.error!);
  };

  const call = async (event: string, ...args: unknown[]) => {
    const res = await send(event, ...args);
    if (!res.ok) notify(res.error!);
  };

  const invite = async () => {
    const url = `${location.origin}${location.pathname}?room=${view.code}`;
    try {
      if (navigator.share) await navigator.share({ title: '마피아 게임 초대', url });
      else {
        await navigator.clipboard.writeText(url);
        notify('초대 링크를 복사했습니다.');
      }
    } catch {
      /* 공유 취소 */
    }
  };

  const Stepper = ({ k, step = 1, suffix = '' }: { k: keyof Settings; step?: number; suffix?: string }) => (
    <div className="stepper">
      {isHost && <button onClick={() => change(k, -step)}>−</button>}
      <b>
        {s[k]}
        {suffix}
      </b>
      {isHost && <button onClick={() => change(k, step)}>+</button>}
    </div>
  );

  return (
    <main className="screen lobby">
      <header className="lobby-head">
        <button className="link" onClick={onLeave}>
          ← 나가기
        </button>
        <div className="room-code" onClick={invite}>
          <span className="muted">방 코드</span>
          <strong>{view.code}</strong>
          <span className="muted small">탭해서 초대 링크 공유</span>
        </div>
      </header>

      <section className="card">
        <h2>
          참가자 <span className="muted">{n}/{MAX_PLAYERS}</span>
        </h2>
        <ul className="player-list">
          {view.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              <span>
                {p.isHost && '👑 '}
                {p.name}
                {p.id === view.me.id && <span className="muted"> (나)</span>}
                {!p.connected && <span className="muted"> · 연결 끊김</span>}
              </span>
              {isHost && !p.isHost && (
                <button className="link danger" onClick={() => call('room:kick', p.id)}>
                  강퇴
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>직업 설정</h2>
        <div className="settings">
          {ROLE_KEYS.map((k) => (
            <div className="setting-row" key={k}>
              <span>
                {ROLE_INFO[k].emoji} {ROLE_INFO[k].name}
              </span>
              <Stepper k={k} />
            </div>
          ))}
          <div className="setting-row">
            <span>{ROLE_INFO.citizen.emoji} 시민 (자동)</span>
            <div className="stepper">
              <b>{citizenCount(s, n)}</b>
            </div>
          </div>
        </div>
      </section>

      <div className="sticky-bottom">
        {error && <p className="error-text">{error}</p>}
        {isHost ? (
          <button className="btn primary big" disabled={!!error} onClick={() => call('game:start')}>
            게임 시작
          </button>
        ) : (
          <p className="muted center">방장이 게임을 시작하기를 기다리는 중…</p>
        )}
      </div>
    </main>
  );
}
