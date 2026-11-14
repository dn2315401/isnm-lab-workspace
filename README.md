# ISNM LAB Workspace · 2026-11-14 작업본

연구 프로젝트, 조성 정보, 조성계산기, 합성 계획, 샘플 계획을 관리하는 React + TypeScript + Vite 웹앱입니다.

11-14 작업본 웹앱: https://isnm-lab-2026-11-14-v1.dn2315401.chatgpt.site

현재 수정 내용은 `work/2026-11-14-v1` 브랜치에 계속 저장합니다. main은 별도 요청이 없으면 유지합니다. `2026-11-14-v1` 태그는 최초 시작본 보관용이며, 현재 수정본은 작업 브랜치에서 확인하세요.

현재 작업본 다운로드, 수정, 재저장은 [공동 개발 가이드](docs/COLLABORATION.md)를 참고하세요.

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
git clone https://github.com/dn2315401/isnm-lab-workspace.git
cd isnm-lab-workspace
git switch work/2026-11-14-v1
npm ci
npm run dev
```

터미널에 표시되는 개발 서버 주소를 브라우저에서 엽니다. 기본 주소는 `http://localhost:5173`입니다.

```bash
npm run test:calculator # 계산·검증 테스트
npm run test:search     # 데이터 검색 검증
npm run build           # TypeScript 검사와 프로덕션 빌드
npm run preview         # 빌드 결과 확인
```

## 구현된 화면과 기능

- 홈 대시보드, 프로젝트 생성·검색·진행률 변경
- 프로젝트 카드 선택 시 전용 상세 페이지
- 조성 정보 9열 편집 표, 원료·Lot 선택, 단위 환산, wt%·mol% 계산
- 프로젝트 목록/상세의 조성계산기 모달, 확대·복원, 닫기 확인
- 질량 직접 입력, 전체 배합 wt%, phr, 분자 몰비, 작용기 당량 계산
- 용매 별도 투입량, 여분량, 밀도 기반 부피 계산, 물성 누락 안내
- 조성 라이브러리와 계산 이력, 버전별 물성·원료 Lot 스냅샷
- 합성 Draft 생성, 순차 샘플 ID 미리보기·중복 검사
- 계획 투입량과 실제 계량량, 반응 조건, 샘플 제작 결과 별도 기록
- 장비 예약·취소, 월별 캘린더, 올리고머 예시 라이브러리
- 연구 데이터 JSON 내보내기

주요 화면: `#project/1`, `#formulation`

## 공동 개발

1. 저장소 소유자가 Settings → Collaborators에서 공동 제작자의 GitHub 계정을 초대합니다.
2. 각자 저장소를 clone하고 작업 브랜치를 만듭니다.
3. 변경 후 계산 테스트와 빌드를 실행합니다.
4. 브랜치를 push하고 Pull Request로 변경 사항을 검토합니다.

```bash
git switch -c feature/my-change
# 파일 수정 후
npm run test:calculator
npm run build
git add .
git commit -m "Describe the change"
git push -u origin feature/my-change
```

이 저장소는 소스 코드 공유용입니다. GitHub에 push하거나 PR을 병합해도 위의 Sites 웹앱이 자동 업데이트되지는 않습니다. 현재 자동 배포 연동은 설정되어 있지 않습니다. Vite 빌드 산출물은 `dist/`이며 정적 호스팅 서비스에 배포할 수 있습니다. Sites 프로젝트 식별 정보는 이 저장소에 포함하지 않았습니다.

## 데이터와 계산의 범위

프로젝트, 조성, 예약, 계산 이력, 합성·샘플 계획은 각 브라우저의 `localStorage`에 저장됩니다. 저장소를 함께 사용해도 서로의 연구 데이터가 동기화되지는 않습니다. 여러 사람이 동일한 실험 데이터를 편집하려면 인증과 공유 데이터베이스를 추가해야 합니다.

예시 원료와 물성은 UI 확인용입니다. 실제 연구 결과가 아니며 실험 전 분자량·밀도·원료 Lot·작용기 정보를 확인해야 합니다. 필요한 물성이 없으면 추정값을 사용하지 않습니다. 질량 직접 입력은 입력 합계를 유지하며, 목표 총량에 대한 스케일링은 사용자가 비례 조정 버튼을 누를 때만 수행합니다.

실제 장비 연결, 로그인, 분석 파일 업로드, 실험 완료 처리는 포함하지 않습니다. API 키·환경변수·실험 데이터는 저장소에 커밋하지 마세요.

## 파일 구성

- `src/main.tsx`: 공통 레이아웃, 홈, 프로젝트 목록, 예약·달력
- `src/ProjectPage.tsx`: 프로젝트 상세, 계산기 모달, 합성·샘플 계획
- `src/calculator-model.ts`: 배합 계산과 샘플 ID 검증
- `src/Formulation.tsx`: 조성 정보 편집 화면
- `src/formulation-model.ts`: 원료·Lot 구조, 단위 환산, 조성 계산
- `src/*.css`: 반응형 화면 스타일
- `tests/calculator.test.cjs`: 계산·검증 테스트
- `scripts/test-calculator.mjs`: 테스트 실행 스크립트

## 데이터 검색 업데이트

날짜 자동 인식, 동일 버전 조성 필터, 관계 탐색, 페이지별 조회, 측정/참조 구분, 최대 5개 샘플 비교와 호환 곡선 비교를 추가했습니다. 구현 범위, 파일, 데이터 계약, 테스트와 미구현 서버 연동은 [데이터 검색 작업 보고](docs/DATA_SEARCH.md)를 참고하세요.

## 글자 크기와 가독성

작은 글자는 읽기 쉬운 최소 크기로 올리고, 큰 제목의 변화는 제한한 공통 rem 글자 단계를 적용했습니다. 표·입력칸·모바일 줄바꿈도 함께 조정했습니다. 조사한 디자인 기준과 적용 범위는 [글자 크기 조정 안내](docs/TYPOGRAPHY.md)에 정리했습니다.

## 연구실 브랜드

지능형 연성 나노 소재 연구실의 원본 심벌을 적용하고, 네이비·블루·흰색을 중심으로 로고의 노랑·분홍·초록을 강조색으로 사용했습니다. 로고 출처와 색상 기준은 [브랜드 적용 안내](docs/BRAND.md)에 정리했습니다.
