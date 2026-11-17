# 정현준 포트폴리오 · GitHub Pages

GitHub 연결이나 별도 유료 폰트 없이 올릴 수 있는 버전입니다. 사진·영상·폰트·웹 실험을 포함합니다.

## 가장 쉬운 방법: 완성본 업로드

`hyunjoon-portfolio-pages.zip`을 사용합니다. 이 파일은 이미 만들어진 웹사이트여서 Node.js 설치나 빌드가 필요 없습니다.

1. ZIP의 압축을 풉니다. `index.html`, 여러 `.js`·`.css` 파일, `assets`, `works` 폴더가 나옵니다.
2. GitHub에서 새 **Public** 저장소를 만듭니다. 예를 들어 `portfolio`라는 이름이면 됩니다. 기존 저장소가 있다면 덮어쓰지 말고 새 이름을 사용하세요.
3. 저장소의 **Add file → Upload files**에서 압축을 푼 **내용물**을 올리고 **Commit changes**를 누릅니다. ZIP 자체나 그 바깥 폴더를 올리지 않습니다. 저장소 첫 화면에 `index.html`이 바로 보여야 합니다. 사진 폴더 구조를 유지하세요.
4. **Settings → Pages → Build and deployment**에서 **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)**를 선택하고 **Save**를 누릅니다.
5. Actions의 Pages 배포가 끝나면 Settings → Pages에 접속 주소가 표시됩니다.

`0826fry` 계정의 `portfolio` 저장소라면 주소는 `https://0826fry.github.io/portfolio/`가 됩니다. `0826fry.github.io`라는 저장소를 만들면 주소는 `https://0826fry.github.io/`가 됩니다. 아직 배포된 주소를 의미하지는 않습니다.

브라우저에서 파일 개수 제한이 나오면 `assets` 폴더와 나머지를 나눠 올리면 됩니다. `.nojekyll` 파일이 숨겨져 보이지 않아도 현재 파일 구조는 기본 Pages 배포로 동작합니다.

## 이 버전의 방명록

GitHub Pages에는 데이터베이스 서버가 없으므로 기본값은 **이 브라우저에 저장**입니다. 사진 색을 따라 수놓기, 뒷면 보기, 실 풀기와 바늘 자국은 유지됩니다. 글은 다른 방문자나 기기와 공유되지 않고, 브라우저 데이터를 지우면 없어집니다. 이 차이를 방명록 안에도 표시했습니다.

공유 방명록을 쓰려면 소스 ZIP에 포함된 `deploy/guestbook/README.md`에 따라 별도 Cloudflare Worker + D1을 배포할 수 있습니다. 아직 서버가 자동으로 만들어진 것은 아닙니다. 기존 사이트의 방명록 데이터도 자동 이전되지 않습니다.

서버 배포 후 완성본의 `hosting-config.js`를 다음처럼 바꾸면 됩니다. 주소는 배포 결과로 받은 실제 주소를 넣으세요. 비밀번호나 API 키는 넣지 않습니다.

```js
window.PORTFOLIO_HOSTING = {
  guestbook: {
    mode: 'remote',
    endpoint: 'https://YOUR-WORKER.workers.dev/api/guestbook'
  }
};
```

## 소스에서 수정하고 자동 배포하기

`hyunjoon-portfolio-source.zip`은 이후 수정용입니다. 완성본 ZIP과 섞어 올리지 마세요. 이쪽은 `index.html`, `public`, `scripts`, `.github`, `package.json` 등을 저장소 루트에 올립니다. `.github` 폴더도 반드시 포함합니다.

- Pages의 Source를 **GitHub Actions**로 선택합니다.
- Actions에서 **Deploy portfolio to GitHub Pages → Run workflow → main**을 선택합니다.
- 이후 `main` 브랜치에 수정 내용을 올리면 자동 배포됩니다.
- 소스의 `public` 폴더를 지우거나 파일 경로를 바꾸지 마세요.

로컬 빌드에는 Node.js 22.13 이상이 필요합니다. 별도 npm 패키지는 필요 없습니다.

```sh
node scripts/build-pages.mjs
```

완성 파일은 `dist/pages`에 생성됩니다. 이를 다른 정적 호스팅에도 올릴 수 있습니다.

본문은 `docs/bilingual-copy.json`에서 수정한 뒤 `node scripts/render-essay.mjs`, 작업 목록은 `public/content.js`에서 수정합니다. 디자인과 인터랙션은 `public` 아래의 CSS/JS입니다.

공유 방명록을 연결할 때는 `pages.config.json`을 수정하거나 저장소의 **Settings → Secrets and variables → Actions → Variables**에 `GUESTBOOK_API_URL`을 설정하고 다시 배포합니다. 이 값은 공개 API 주소이며 비밀 키가 아닙니다.

## 확인한 범위

기존 디자인과 한영 전환, BANANA·ABRACADABRA·DIGITAL FADING, 사진·영상 및 Your/My/Our Own Summer 구성을 포함합니다. 루트 주소와 `/portfolio/` 같은 하위 경로에서 자산 경로가 맞도록 구성했습니다. 실제 GitHub 배포 완료 여부는 사용자의 저장소 Actions에서 확인해야 합니다.

공식 안내:
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
