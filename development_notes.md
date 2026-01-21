# 팀 운영비 관리 (Team Budget Manager) - 개발 노트

## 1. 프로젝트 개요
팀 운영 비용을 관리하기 위한 웹 기반 어플리케이션입니다. 분기별 예산 추적, 다중 통화(KRW/USD) 지출 관리, 팀원 관리 및 비용 범주화 기능을 지원합니다.

## 2. 파일 구조
- **index.html**: 메인 어플리케이션 구조. 대시보드, 팀원, 비용 등록, 내역 탭을 위한 시맨틱 섹션 포함.
- **styles.css**: CSS 변수를 활용한 테마(Inter 폰트, 반응형 디자인) 적용 어플리케이션 스타일링.
- **app.js**: 상태 관리, 로컬 스토리지(LocalStorage) 지속성, DOM 조작 및 이벤트 처리를 포함한 핵심 로직.
- **package.json**: 로컬 개발 서버(Vite) 실행을 위한 설정 파일.

## 3. 개발 환경 실행
이 프로젝트는 정적 파일로 구성되어 있지만, 편리한 개발을 위해 Vite를 사용합니다.
- **설치**: `npm install`
- **실행**: `npm run dev` (로컬 서버 시작)
- **빌드**: `npm run build`

## 4. 주요 기능
- **예산 관리**:
  - 분기별 예산 추적 (기본값: 435,000원).
  - 월간 및 연간 보기 지원.
  - 예산 사용량을 시각적인 진행률 표시줄과 링으로 표시.
- **팀 관리**:
  - 팀 목록 생성, 삭제, 이름 수정 등 관리 기능.
  - 팀원 등록 시 소속 팀 할당 및 팀별 관리.
- **데이터 보존 및 내보내기**:
  - `localStorage` (키: `teamBudgetData`)를 사용하여 팀원, 비용, 구독 정보 저장.
  - 데이터 가져오기/내보내기 (JSON 형식) 기능.
  - **엑셀 내보내기**: 지출 내역을 `.xlsx` 파일로 다운로드 (SheetJS 사용).
    - 포함 항목: 날짜, 팀명, 이름, 카테고리, 내용, 금액(원화/외화/환율), 구독 여부 및 결제 확정 상태.
- **UI/UX 개선**:
  - **프리미엄 디자인 복구**: 그라데이션 헤더, 카드 그림자, 둥근 모서리 등 고급스러운 UI 테마 적용.
  - **사용자 피드백 강화**: 데이터가 없거나 작업이 완료되었을 때 '토스트(Toast)' 알림 메시지 표시 (기존 스타일 누락 문제 해결).
- **비용 추적**:
  - 날짜, 카테고리, 상세 내용을 포함한 비용 등록.
  - 정기 구독(반복 지출) 지원.
  - **구독 결제 확정 시스템**: 매월 결제일이 지난 구독 건에 대해 [결제 확정]을 수행하면, 해당 시점의 환율이 적용된 실제 지출 내역으로 변환되어 저장됨 (실시간 환율 변동에 영향받지 않음).
  - 실시간 API(`api.exchangerate-api.com`)를 사용한 통화 환산(USD -> KRW).

## 4. 데이터 구조 (State)
```javascript
let state = {
    members: [
        { id: Number, name: String, role: String, teamId: Number }
    ],
    expenses: [
        {
            id: Number,
            memberId: Number,
            date: String (YYYY-MM-DD),
            category: String,
            description: String,
            currency: "KRW" | "USD",
            amount: Number,
            amountKRW: Number,
            isSubscription: Boolean
        }
    ],
    subscriptions: [], // 정기 지출 객체 배열
    teams: [
        { id: Number, name: String }
    ],
    exchangeRate: Number, // 현재 USD/KRW 환율
    currentQuarter: Number, // 1, 2, 3, 4, 또는 'all'
    config: {
        teamName: String,
        quarterBudget: Number
    }
};
```

## 5. 관찰 사항 및 개선 가능성
- **UI/UX**:
  - 깔끔하고 반응형인 디자인.
  - 데이터가 없을 때의 상태(Empty states)를 잘 활용함.
  - 구독 배지 통합이 시각적으로 잘 보임.
- **코드 품질**:
  - `app.js` 내 함수 모듈화 (render* 함수들).
  - 관심사의 명확한 분리.
- **향후 고려 사항**:
  - 다중 사용자 동기화를 위한 백엔드 통합.
  - 사용자 인증(로그인).
  - 고급 보고서/차트 기능.
