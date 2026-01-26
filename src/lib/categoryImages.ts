/**
 * 카테고리별 이미지 매핑 유틸리티
 * 
 * 사용 방법:
 * 1. public/category_images/ 폴더에 카테고리별 이미지 파일을 저장하세요
 * 2. 아래 CATEGORY_IMAGE_MAP에 카테고리와 이미지 경로를 매핑하세요
 * 3. 이미지 파일명 예시:
 *    - 01.png, 02.png ... (카테고리별 숫자 파일명)
 */

import { QuestionCategory } from '@/types';

/**
 * 카테고리별 이미지 경로 매핑
 * public 폴더 기준 경로를 사용합니다 (예: /category_images/01.png)
 */
export const CATEGORY_IMAGE_MAP: Record<NonNullable<QuestionCategory>, string | null> = {
  // 1. 음식점
  '음식점': '/category_images/01.png',
  // 2. 카페
  '카페': '/category_images/02.png',
  // 3. 옷가게
  '옷가게': '/category_images/03.png',
  // 4. 엑티비티 (이미지 파일 없음 → 더미 div)
  '엑티비티': '/category_images/04.png',
  // 5. 휴식
  '휴식': '/category_images/05.png',
  // 6. 관람
  '관람': '/category_images/06.png',
  // 7. 컨퍼런스 (이미지 파일 없음 → 더미 div)
  '컨퍼런스': '/category_images/07.png',
  // 8. 행사/이벤트 (이미지 파일 없음 → 더미 div)
  '행사/이벤트': '/category_images/08.png',
  // 9. 전시
  '전시': '/category_images/09.png',
  // 10. 편의 시설
  '편의 시설': '/category_images/10.png',
};

/**
 * 카테고리에 해당하는 이미지 경로를 반환합니다
 * @param category 질문 카테고리
 * @returns 이미지 경로 (없으면 null)
 */
export function getCategoryImage(category: QuestionCategory | null | undefined): string | null {
  if (!category) {
    return null;
  }
  return CATEGORY_IMAGE_MAP[category] || null;
}

/**
 * 카테고리 이미지가 존재하는지 확인합니다
 * @param category 질문 카테고리
 * @returns 이미지 경로가 있으면 true
 */
export function hasCategoryImage(category: QuestionCategory | null | undefined): boolean {
  return getCategoryImage(category) !== null;
}
