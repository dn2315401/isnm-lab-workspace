# 11-14 작업본 공동 개발

현재 작업 공간은 `work/2026-11-14-v1` 브랜치입니다. 브랜치 이름에 v1이 있지만, 사용자와 합의한 대로 **11-14 작업본에 계속 저장**합니다. 별도 요청이 없으면 v2를 만들거나 main을 변경하지 않습니다.

- [11-14 작업 파일](https://github.com/dn2315401/isnm-lab-workspace/tree/work/2026-11-14-v1)
- [현재 작업본 ZIP](https://github.com/dn2315401/isnm-lab-workspace/archive/refs/heads/work/2026-11-14-v1.zip)
- 웹앱: https://isnm-lab-2026-11-14-v1.dn2315401.chatgpt.site

GitHub 첫 화면의 브랜치 선택 버튼에서 `work/2026-11-14-v1`을 선택하면 현재 파일이 보입니다. 실제 화면과 기능 코드는 `src/`, 안내는 `docs/`, 테스트는 `tests/` 폴더에 있습니다. 날짜 이름의 폴더를 별도로 만드는 방식이 아닙니다.

기존 `2026-11-14-v1` 태그와 Release ZIP은 최초 시작본의 보관본입니다. 현재 수정본을 받으려면 위의 **브랜치 ZIP**을 사용하세요. 이전 수정 내용은 브랜치의 Commits에서 찾을 수 있습니다.

## 내려받기·실행

Node.js 22 이상을 사용합니다. 수정 후 다시 GitHub에 저장할 때는 ZIP보다 clone이 편리합니다.

```bash
git clone --branch work/2026-11-14-v1 https://github.com/dn2315401/isnm-lab-workspace.git
cd isnm-lab-workspace
npm ci
npm run dev
```

## 같은 11-14 작업본에 저장

```bash
git switch work/2026-11-14-v1
git pull --ff-only origin work/2026-11-14-v1
# 코드 수정
npm run test:calculator
npm run test:search
npm run build
git add .
git commit -m "11-14 수정: 변경 내용을 적으세요"
git push origin work/2026-11-14-v1
```

다른 사람이 같은 파일을 고쳤다면 pull/push 충돌 내용을 먼저 확인합니다. force push로 다른 사람의 수정 이력을 지우지 않습니다. 동시에 큰 변경을 할 때는 별도 기능 브랜치와 Pull Request로 11-14 브랜치에 합칠 수 있습니다. main 반영은 별도로 요청할 때 진행합니다.

채팅에서는 “11-14 작업본에서 [변경 내용]을 수정하고 같은 곳에 저장해줘”라고 요청하면 됩니다.

GitHub 코드 저장과 실행 웹앱 배포는 별도입니다. 이 앱에서 입력한 실험 데이터도 각 브라우저에 따로 저장되며 GitHub에 자동 업로드되지 않습니다.
