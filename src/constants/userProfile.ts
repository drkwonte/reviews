/** profiles.user_level 후보 (자유 입력도 가능하도록 UI에서 보조용) */
export const USER_LEVEL_SELECT_VALUE_NONE = '__none__'

/** 목록에 없을 때 자유 입력 */
export const USER_LEVEL_CUSTOM = '__custom__'

export const USER_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: USER_LEVEL_SELECT_VALUE_NONE, label: '선택 안 함' },
  { value: '초등', label: '초등' },
  { value: '중1', label: '중학교 1학년' },
  { value: '중2', label: '중학교 2학년' },
  { value: '중3', label: '중학교 3학년' },
  { value: '고1', label: '고등학교 1학년' },
  { value: '고2', label: '고등학교 2학년' },
  { value: '고3', label: '고등학교 3학년' },
  { value: 'N수', label: 'N수 / 재수' },
  { value: '대학생', label: '대학생' },
  { value: '성인·기타', label: '성인·기타' },
  { value: USER_LEVEL_CUSTOM, label: '직접 입력' },
]
