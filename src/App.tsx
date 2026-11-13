import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken, loadSession, saveSession, send, socket } from './socket';
import type { GameView } from './types';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Game from './screens/Game';

export type Notify = (msg: string) => void;

export default function App() {
  const [view, setView] = useState<GameView | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  const notify = useCallback<Notify>((msg) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    // 연결(또는 재연결)될 때마다 저장된 방으로 자동 복귀
    const onConnect = async () => {
      setConnected(true);
      const s = loadSession();
      if (!s) return;
      const res = await send('room:join', { code: s.code, name: s.name, token: getToken() });
      if (!res.ok) {
        saveSession(null);
        setView(null);
        notify(res.error ?? '방에 다시 접속하지 못했습니다.');
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = (v: GameView) => {
      setView(v);
    };
    const onKicked = () => {
      saveSession(null);
      setView(null);
      notify('방장에 의해 강퇴되었습니다.');
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('kicked', onKicked);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('kicked', onKicked);
    };
  }, [notify]);

  const leave = async () => {
    await send('room:leave');
    saveSession(null);
    setView(null);
  };

  return (
    <div className={`app phase-${view?.phase ?? 'home'}`}>
      {!connected && <div className="banner warn">서버에 연결 중…</div>}
      {!view ? (
        <Home notify={notify} />
      ) : view.phase === 'lobby' ? (
        <Lobby view={view} notify={notify} onLeave={leave} />
      ) : (
        <Game view={view} notify={notify} onLeave={leave} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
