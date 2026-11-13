import type { NightStep, Phase, Role, Settings } from './types';

export const ROLE_INFO: Record<Role, { name: string; emoji: string; team: '마피아팀' | '시민팀'; desc: string }> = {
  mafia: { name: '마피아', emoji: '🔪', team: '마피아팀', desc: '밤마다 동료 마피아와 함께 한 명을 처치합니다. 마피아팀이 나머지 수 이상이 되면 승리!' },
  spy: {
    name: '스파이',
    emoji: '🕵',
    team: '마피아팀',
    desc: '밤마다 한 명을 골라 마피아인지 확인합니다. 마피아를 찾으면 접선하여 그때부터 마피아와 함께 처치 대상을 고릅니다.',
  },
  police: { name: '경찰', emoji: '🚓', team: '시민팀', desc: '밤마다 한 명을 조사해 마피아인지 알아냅니다.' },
  doctor: { name: '의사', emoji: '💉', team: '시민팀', desc: '밤마다 한 명을 치료합니다. 마피아가 노린 사람을 치료하면 살릴 수 있습니다. (자신 가능, 같은 사람 연속 치료 불가)' },
  politician: { name: '정치인', emoji: '🏛', team: '시민팀', desc: '투표 시 2표를 행사하며, 투표로는 처형되지 않습니다.' },
  gangster: {
    name: '깡패',
    emoji: '😠',
    team: '시민팀',
    desc: '밤마다 한 명을 지목합니다. 지목된 사람은 다음 날 말을 할 수 없고, 투표는 무효가 되며, 그날 밤 능력을 쓸 수 없습니다.',
  },
  citizen: { name: '시민', emoji: '🙂', team: '시민팀', desc: '능력은 없지만 토론과 투표로 마피아를 찾아내세요.' },
};

/** 밤 차례 안내 문구 – 모든 사람의 폰에 똑같이 표시 (해당 직업이 죽었어도 표시) */
export const NIGHT_STEP_TEXT: Record<NightStep, { emoji: string; text: string }> = {
  spy: { emoji: '🕵', text: '스파이는 정체를 확인할 사람을 선택하세요' },
  mafia: { emoji: '🔪', text: '마피아는 처치할 사람을 선택하세요' },
  doctor: { emoji: '💉', text: '의사는 치료할 사람을 선택하세요' },
  police: { emoji: '🚓', text: '경찰은 조사할 사람을 선택하세요' },
  gangster: { emoji: '😠', text: '깡패는 협박할 사람을 선택하세요' },
};

export const PHASE_LABEL: Record<Phase, string> = {
  lobby: '대기실',
  intro: '첫날 밤 · 동료 확인',
  night: '밤',
  day: '낮',
  vote: '투표',
  voteResult: '투표 결과',
  defense: '최후의 반론',
  final: '찬반 투표',
  execution: '처형 결과',
  ended: '게임 종료',
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

/** 서버의 Room.validateRoles 와 동일한 규칙 */
export function validateRoles(s: Settings, n: number): string | null {
  if (n < MIN_PLAYERS) return `최소 ${MIN_PLAYERS}명이 필요합니다.`;
  if (specialCount(s) > n) return '직업 수가 인원보다 많습니다.';
  if ((s.mafia + s.spy) * 2 >= n) return '마피아팀(마피아+스파이)은 전체 인원의 절반보다 적어야 합니다.';
  return null;
}

function specialCount(s: Settings) {
  return s.mafia + s.spy + s.police + s.doctor + s.politician + s.gangster;
}

export function citizenCount(s: Settings, n: number) {
  return Math.max(0, n - specialCount(s));
}
