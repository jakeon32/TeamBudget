# Team Budget Manager (팀 운영비 관리)

효율적인 팀 운영비 관리를 위한 웹 기반 대시보드입니다.

## 주요 기능 (Features)

*   **분기별 예산 관리**: 분기별 예산을 설정하고 지출 현황을 시각적으로 확인할 수 있습니다.
*   **팀원 관리**: 팀원을 등록하고 개인별 지출 내역을 추적할 수 있습니다.
*   **비용 등록 및 관리**:
    *   카테고리별 지출 기록
    *   다중 통화 지원 (KRW/USD) 및 환율 자동 계산
    *   월 정기 구독(Recurring Subscription) 관리
*   **커스터마이징**:
    *   팀 이름 및 분기 예산 설정 기능 (브라우저 저장)
*   **데이터 관리**:
    *   데이터 내보내기/가져오기 (JSON 백업)
    *   LocalStorage를 이용한 자동 저장

## 기술 스택 (Tech Stack)

*   **Frontend**: HTML5, CSS3 (Variables, Flexbox/Grid), JavaScript (Vanilla)
*   **Data Storage**: Web LocalStorage
*   **Library/API**:
    *   ExchangeRate-API (실시간 환율 정보)
    *   Google Fonts (Inter)

## 설치 및 실행 (Installation & Usage)

별도의 서버 설치가 필요 없는 정적 웹 애플리케이션입니다.

1.  이 저장소를 클론합니다.
    ```bash
    git clone https://github.com/jakeon32/TeamBudget.git
    ```
2.  `index.html` 파일을 브라우저에서 엽니다.

## 사용 방법 (How to use)

1.  **초기 설정**: 우측 상단 ⚙️ 설정을 눌러 팀명과 분기 예산을 입력합니다.
2.  **팀원 등록**: [팀원 관리] 탭에서 팀원을 추가합니다.
3.  **비용 등록**: [비용 등록] 탭에서 지출 내역을 입력합니다.
4.  **현황 확인**: [대시보드] 탭에서 월별/팀원별/분기별 현황을 확인합니다.

---
Developed by Antigravity
