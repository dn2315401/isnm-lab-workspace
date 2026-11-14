# 날짜·버전별 공동 개발

## 이번 시작본

- 이름: **ISNM LAB · 2026-11-14 · v1**
- GitHub 기준 커밋: `258a1b05a89b6ed688c595e68fd75b456f7cd781`
- 작업 브랜치: `work/2026-11-14-v1`
- 저장 태그: `2026-11-14-v1`
- 실행 웹앱: https://isnm-lab-2026-11-14-v1.dn2315401.chatgpt.site

최신 main에 병합된 올리고머 배치 관리, 원료물질 데이터, 검색, 장비 예약 코드를 포함한 시작본입니다. GitHub에 아직 올라오지 않은 별도 로컬 작업은 포함하지 않습니다.

## 내려받아 실행하기

코드 수정 후 다시 GitHub에 올릴 예정이라면 ZIP 대신 clone을 권장합니다.

```bash
git clone https://github.com/dn2315401/isnm-lab-workspace.git
cd isnm-lab-workspace
git switch work/2026-11-14-v1
npm ci
npm run dev
```

Node.js 22 이상을 사용합니다. 버전별 고정 ZIP은 저장소의 Releases에서 내려받을 수 있습니다. 화면 오른쪽 위 날짜·버전을 누르면 소스 코드와 ZIP 링크도 표시됩니다. 브라우저 화면을 저장하는 것은 소스 코드 저장과 다릅니다.

## 다음 수정본을 저장하는 예시: 2026-11-14 v2

먼저 공동 제작자와 어떤 버전에서 작업을 시작할지 정합니다. 아래는 v1에서 v2를 만드는 예시입니다. 이후 날짜와 v숫자는 작업 상황에 맞게 바꿉니다.

```bash
git fetch origin --tags
git switch -c work/2026-11-14-v2 2026-11-14-v1
npm ci
npm run version:set -- 2026-11-14 v2
# 소스 파일 수정
npm run test:calculator
npm run build
git add .
git commit -m "Save 2026-11-14 v2: 변경 내용을 적으세요"
git push -u origin work/2026-11-14-v2
```

작업이 끝난 버전에는 태그를 붙입니다. 기존 태그는 이동하지 말고 새 버전을 사용합니다.

```bash
git tag -a 2026-11-14-v2 -m "ISNM LAB 2026-11-14 v2"
git push origin 2026-11-14-v2
```

GitHub의 Releases → Draft a new release에서 이 태그를 선택해 저장하면 해당 소스 ZIP을 공동 제작자에게 전달할 수 있습니다. GitHub CLI가 설치되어 있으면 다음 명령도 사용할 수 있습니다.

```bash
gh release create 2026-11-14-v2 --verify-tag --title "ISNM LAB · 2026-11-14 · v2" --notes "오늘 변경한 기능과 확인 결과를 적으세요."
```

여러 사람이 병렬로 작업할 때는 각자 브랜치를 만들고 Pull Request에서 변경을 비교한 뒤 합칩니다. 검토한 변경을 main에 반영하려면 해당 작업 브랜치에서 main을 대상으로 PR을 만듭니다. 공동 제작자가 push하려면 저장소 Settings → Collaborators에서 쓰기 권한을 받아야 합니다.

## 채팅에서 작업을 이어갈 때

다음처럼 저장소와 기준 버전을 알려주면 서로 다른 버전을 혼동하지 않습니다.

> GitHub `dn2315401/isnm-lab-workspace`의 `2026-11-14-v1`에서 시작해서 [수정할 내용]을 바꿔줘. 작업 후 `2026-11-14-v2`로 저장하고 실행 웹앱도 새로 배포해줘.

## 소스 코드 저장과 웹앱 배포

GitHub의 브랜치·태그·Release는 소스 코드 버전입니다. GitHub에 저장했다고 Sites 웹앱이 자동 배포되지는 않습니다. 웹앱 링크를 갱신하려면 빌드와 배포를 별도로 진행합니다. `.openai/hosting.json`은 배포 대상별 설정이므로 이 저장소에는 포함하지 않습니다.

프로젝트·조성·예약·계산 이력·합성 계획은 각 브라우저의 localStorage에 있습니다. 새 웹앱 주소는 별도의 브라우저 저장 공간을 사용하므로 기존 주소의 실험 데이터가 자동으로 옮겨오지 않습니다. GitHub 코드 공유만으로 여러 사람의 실험 데이터가 동기화되지는 않습니다.
