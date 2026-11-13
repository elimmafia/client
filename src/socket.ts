import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || `${location.protocol}//${location.hostname}:4000`;

export const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

export interface Ack {
  ok: boolean;
  error?: string;
  code?: string;
}

/** 서버에 이벤트를 보내고 응답(ack)을 기다린다 */
export function send(event: string, ...args: unknown[]): Promise<Ack> {
  return new Promise((resolve) => {
    socket.timeout(8000).emit(event, ...args, (err: Error | null, res: Ack) => {
      resolve(err ? { ok: false, error: '서버 응답이 없습니다.' } : res);
    });
  });
}

function randomToken() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 기기별 비밀 토큰 – 새로고침/재접속 시 같은 플레이어로 복귀하는 데 사용 */
export function getToken(): string {
  const s = storage();
  let t = s?.getItem('mafia.token');
  if (!t) {
    t = randomToken();
    s?.setItem('mafia.token', t);
  }
  return t;
}

export interface SavedSession {
  code: string;
  name: string;
}

export function loadSession(): SavedSession | null {
  try {
    return JSON.parse(storage()?.getItem('mafia.session') ?? 'null');
  } catch {
    return null;
  }
}

export function saveSession(s: SavedSession | null) {
  const st = storage();
  if (!st) return;
  if (s) st.setItem('mafia.session', JSON.stringify(s));
  else st.removeItem('mafia.session');
}

export function loadName(): string {
  return storage()?.getItem('mafia.name') ?? '';
}

export function saveName(name: string) {
  storage()?.setItem('mafia.name', name);
}
