
import type { CSSProperties } from 'react';
import type { PublicPlayer } from '@/types';
import { ROLE_INFO } from '@/roles';

type GridProps = {
  players: PublicPlayer[];
  meId: string;
  selectable?: (p: PublicPlayer) => boolean;
  selected?: string | null;
  teamPicks?: string[];
  mafiaCount?: number;
  revealAllRoles?: boolean;
  onSelect?: (p: PublicPlayer) => void;
};

export default function Grid({
  players,
  meId,
  selectable,
  selected,
  teamPicks,
  mafiaCount,
  revealAllRoles = false,
  onSelect,
}: GridProps) {
  const isMafiaPick =
    teamPicks !== undefined &&
    mafiaCount !== undefined;

  const total = Math.max(1, mafiaCount ?? 1);

  return (
    <div className="grid">
      {players.map((p) => {
        const can = !!selectable?.(p);
        const roleInfo = p.role ? ROLE_INFO[p.role] : null;

        const pickCount = isMafiaPick
          ? teamPicks.filter((id) => id === p.id).length
          : 0;

        const percent = isMafiaPick
          ? Math.min(100, (pickCount / total) * 100)
          : 0;

        const isSelected = selected === p.id;

        const style = isMafiaPick
          ? ({
              '--mafia-fill': `${percent}%`,
            } as CSSProperties)
          : undefined;

        return (
          <button
            key={p.id}
            type="button"
            className={[
              'pcell',
              !p.alive && 'dead',
              can && 'can',
              isSelected && 'selected',
              (p.role === 'mafia' ||
                (p.role === 'spy' && p.id !== meId)) &&
                'is-mafia',
              !p.connected && 'offline',
              isMafiaPick && 'mafia-fill-card',
            ]
              .filter(Boolean)
              .join(' ')}
            style={style}
            disabled={!can}
            onClick={() => can && onSelect?.(p)}
          >
            <span className="pname">
              {p.isHost && '👑'}
              {p.name}
                {isMafiaPick && isSelected && (
                <span className="mafia-my-check"> ✅</span>
                )}
            </span>
            {/* 마피아가 직접 선택한 대상만 체크 표시 */}

            <span className="psub">
                {revealAllRoles ? (
                    // 사망자 관전 화면: 생존/사망 관계없이 실제 직업 표시
                    roleInfo ? (
                    <>
                        {roleInfo.emoji} {roleInfo.name}
                    </>
                    ) : (
                    '직업 정보 없음'
                    )
                ) : (
                    // 일반 화면: 기존 표시 방식 유지
                    <>
                    {!p.alive
                        ? '사망'
                        : p.id === meId
                        ? '나'
                        : !p.connected
                            ? '연결 끊김'
                            : ''}

                    {roleInfo && p.id !== meId
                        ? ` ${roleInfo.emoji}${roleInfo.name}`
                        : ''}
                    </>
                )}
                </span>
          </button>
        );
      })}
    </div>
  );
}
