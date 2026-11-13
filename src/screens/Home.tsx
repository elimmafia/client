import { useState } from 'react';
import { getToken, loadName, saveName, saveSession, send } from '../socket';
import type { Notify } from '../App';

export default function Home({ notify }: { notify: Notify }) {
  const params = new URLSearchParams(location.search);
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState((params.get('room') ?? '').toUpperCase());
  const [busy, setBusy] = useState(false);

  const go = async (mode: 'create' | 'join') => {
    const n = name.trim();
    if (!n) return notify('닉네임을 입력하세요.');
    if (mode === 'join' && code.trim().length !== 4) return notify('4자리 방 코드를 입력하세요.');
    setBusy(true);
    saveName(n);
    const res =
      mode === 'create'
        ? await send('room:create', { name: n, token: getToken() })
        : await send('room:join', { code: code.trim(), name: n, token: getToken() });
    setBusy(false);
    if (!res.ok || !res.code) return notify(res.error ?? '실패했습니다.');
    saveSession({ code: res.code, name: n });
    history.replaceState(null, '', location.pathname);
  };

  return (
    <main className="screen home">
      <div className="logo">
        <div className="moon">🌙</div>
        <h1>마피아</h1>
        <p className="muted">핸드폰으로 즐기는 오프라인 마피아 게임</p>
      </div>

      <label className="field">
        <span>닉네임</span>
        <input value={name} maxLength={12} placeholder="최대 12자" onChange={(e) => setName(e.target.value)} />
      </label>

      <button className="btn primary big" disabled={busy} onClick={() => go('create')}>
        방 만들기
      </button>

      <div className="divider">또는</div>

      <label className="field">
        <span>방 코드</span>
        <input
          className="code-input"
          value={code}
          maxLength={4}
          placeholder="ABCD"
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
      </label>
      <button className="btn big" disabled={busy} onClick={() => go('join')}>
        참가하기
      </button>
    </main>
  );
}
