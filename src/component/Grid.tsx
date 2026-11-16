import {PublicPlayer} from '@/types';
import { NIGHT_STEP_TEXT, PHASE_LABEL, ROLE_INFO } from '@/roles';

type GridProps = {
  players: PublicPlayer[];
  meId: string;
  selectable?: (p: PublicPlayer) => boolean;
  selected?: string | null;
  teamPicks?: string[];
  onSelect?: (p: PublicPlayer) => void;
};

export default function Grid({
  players,
  meId,
  selectable,
  selected,
  teamPicks,
  onSelect,
}: GridProps) {
  return (
    <div className="grid">
      {players.map((p) => {
        const can = !!selectable?.(p);
        const roleInfo = p.role ? ROLE_INFO[p.role] : null;

        const pickCount = teamPicks?.filter(
          (id) => id === p.id
        ).length ?? 0;

        const mafiaPickClass = teamPicks
          ? pickCount >= 2
            ? 'mafia-pick-full'
            : pickCount === 1
              ? 'mafia-pick-half'
              : ''
          : '';

        return (
          <button
            key={p.id}
            className={[
              'pcell',
              !p.alive && 'dead',
              can && 'can',
              selected === p.id && 'selected',
              mafiaPickClass,
              (p.role === 'mafia' ||
                (p.role === 'spy' && p.id !== meId)) &&
                'is-mafia',
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
            </span>

            {teamPicks && pickCount > 0 && (
              <span className="mafia-pick-status">
                {pickCount >= 2
                  ? '✓ 선택 일치'
                  : '선택 대기'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}