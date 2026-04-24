import type { NicheCategory } from './types';

/**
 * 20개 카테고리 프리셋. 사용자가 첫 방문 시 하나 선택하면 활성 카테고리가 된다.
 * 프리셋에 없는 분야는 Options에서 커스텀 키워드로 추가 가능.
 *
 * 키워드는 YouTube search.list의 q 파라미터에 그대로 들어가므로, 영어 키워드와
 * 해당 언어 키워드를 모두 준비. 선택 시 language/regionCode에 맞춰 필터링.
 */
export const CATEGORY_PRESETS: readonly Omit<
  NicheCategory,
  'id' | 'isPreset'
>[] = [
  {
    label: 'Fitness & Wellness',
    emoji: '🏋️',
    keywords: ['home workout', 'HIIT', 'strength training', 'yoga', 'running'],
    language: 'en',
  },
  {
    label: 'Beauty & Skincare',
    emoji: '💄',
    keywords: ['skincare routine', 'makeup tutorial', 'hair care', 'clean beauty'],
    language: 'en',
  },
  {
    label: 'Personal Finance',
    emoji: '💰',
    keywords: ['personal finance', 'investing for beginners', 'passive income', 'budgeting'],
    language: 'en',
  },
  {
    label: 'AI & Tech Talk',
    emoji: '🤖',
    keywords: ['AI tools', 'ChatGPT tutorial', 'Claude tips', 'prompt engineering', 'LLM'],
    language: 'en',
  },
  {
    label: 'Gaming',
    emoji: '🎮',
    keywords: ['game review', 'gameplay', 'esports', 'mobile gaming'],
    language: 'en',
  },
  {
    label: 'Fashion',
    emoji: '👗',
    keywords: ['fashion haul', 'streetwear', 'outfit of the day', 'sustainable fashion'],
    language: 'en',
  },
  {
    label: 'Food & Cooking',
    emoji: '🍳',
    keywords: ['recipe', 'home cooking', 'food review', 'meal prep'],
    language: 'en',
  },
  {
    label: 'Travel',
    emoji: '✈️',
    keywords: ['travel vlog', 'backpacking', 'budget travel', 'city guide'],
    language: 'en',
  },
  {
    label: 'Home & Interior',
    emoji: '🏠',
    keywords: ['home decor', 'interior design', 'DIY home', 'gardening'],
    language: 'en',
  },
  {
    label: 'Parenting',
    emoji: '👶',
    keywords: ['parenting tips', 'toddler activities', 'newborn care'],
    language: 'en',
  },
  {
    label: 'Education',
    emoji: '📚',
    keywords: ['study tips', 'online learning', 'how to learn', 'productivity students'],
    language: 'en',
  },
  {
    label: 'Creator Economy',
    emoji: '💼',
    keywords: ['content creation', 'youtube growth', 'influencer marketing', 'creator business'],
    language: 'en',
  },
  {
    label: 'Developer Tools',
    emoji: '💻',
    keywords: ['VS Code', 'developer productivity', 'programming tutorial', 'framework review'],
    language: 'en',
  },
  {
    label: 'B2B SaaS & Productivity',
    emoji: '🏢',
    keywords: ['SaaS review', 'Notion tutorial', 'productivity app', 'workflow automation'],
    language: 'en',
  },
  {
    label: 'Cybersecurity',
    emoji: '🔐',
    keywords: ['cybersecurity tips', 'ethical hacking', 'privacy', 'infosec'],
    language: 'en',
  },
  {
    label: 'Van Life & Digital Nomad',
    emoji: '🚐',
    keywords: ['van life', 'digital nomad', 'remote work travel'],
    language: 'en',
  },
  {
    label: 'Sustainability & Eco Life',
    emoji: '🌱',
    keywords: ['zero waste', 'sustainable living', 'eco friendly'],
    language: 'en',
  },
  {
    label: 'Pets & Animals',
    emoji: '🐕',
    keywords: ['pet care', 'dog training', 'cat behavior', 'pet review'],
    language: 'en',
  },
  {
    label: 'Cars & Automotive',
    emoji: '🚗',
    keywords: ['car review', 'EV', 'car modification', 'auto news'],
    language: 'en',
  },
  {
    label: 'Crypto / Web3',
    emoji: '🪙',
    keywords: ['crypto analysis', 'web3', 'DeFi', 'Bitcoin news', 'altcoin'],
    language: 'en',
  },
];

/**
 * 한국어 키워드 오버라이드. 선택 시 UI에서 언어 토글로 전환.
 */
export const CATEGORY_KEYWORDS_KO: Record<string, string[]> = {
  'Fitness & Wellness': ['홈트', '헬스', '요가', '러닝', '단백질 식단'],
  'Beauty & Skincare': ['스킨케어 루틴', '메이크업 튜토리얼', '뷰티 리뷰'],
  'Personal Finance': ['재테크', '주식 투자', '부업', '가계부'],
  'AI & Tech Talk': ['AI 도구', 'ChatGPT 활용', '생산성 AI'],
  'Gaming': ['게임 리뷰', '게임 실황', '모바일 게임'],
  'Food & Cooking': ['요리', '레시피', '맛집', '집밥'],
  'Travel': ['여행 브이로그', '배낭여행', '호텔 리뷰'],
  'Parenting': ['육아', '아이 장난감', '신생아 육아'],
  'Developer Tools': ['개발자', '프로그래밍 강좌', '프레임워크 리뷰'],
  'Crypto / Web3': ['코인', '비트코인 분석', '알트코인'],
};
