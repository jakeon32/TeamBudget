// 팀 운영비 관리 시스템

// 분기별 월 정보
const QUARTER_MONTHS = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12],
    all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
};

const MONTH_NAMES = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

// 상태 관리
let state = {
    members: [],
    expenses: [],
    subscriptions: [], // 월 정기 구독 목록
    teams: [], // 팀 목록 (각 팀은 { id, name, quarterBudget } 구조)
    exchangeRate: 1450, // 기본 환율 (실시간으로 업데이트됨)
    currentQuarter: 1, // 현재 선택된 분기
    currentTeamId: null, // 현재 선택된 팀 ID
    // 설정 (기본값) - 하위 호환용
    config: {
        teamName: '팀 운영비 관리',
        quarterBudget: 0
    }
};

// 로컬 스토리지 키
const STORAGE_KEY = 'teamBudgetData';

// ============ 초기화 ============
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    initTabs();
    initForms();
    initFilters();
    fetchExchangeRate();
    setDefaultDate();
    renderAll();
});

// 로컬 스토리지에서 데이터 로드
function loadFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const data = JSON.parse(saved);
        state.members = data.members || [];
        state.expenses = data.expenses || [];
        state.subscriptions = data.subscriptions || [];
        state.teams = data.teams || []; // 팀 데이터 로드
        // 설정 로드 (기존 데이터에 없으면 기본값 유지)
        if (data.config) {
            state.config = { ...state.config, ...data.config };
        }

        // 기존 데이터 마이그레이션
        let needsSave = false;

        // 1. isSubscription 필드가 없는 경우 추가
        state.expenses = state.expenses.map(expense => {
            if (expense.isSubscription === undefined) {
                needsSave = true;
                return {
                    ...expense,
                    isSubscription: false,
                    subscriptionGroupId: null
                };
            }
            return expense;
        });

        // 2. '크리에이티브' 팀이 있고, teamId가 없는 멤버들에게 해당 팀 할당
        const creativeTeam = state.teams.find(t => t.name === '크리에이티브');
        if (creativeTeam) {
            state.members.forEach(member => {
                if (!member.teamId) {
                    member.teamId = creativeTeam.id;
                    needsSave = true;
                }
            });
        }

        // 3. 팀에 quarterBudget 필드가 없는 경우 추가 (기존 config에서 마이그레이션)
        state.teams.forEach(team => {
            if (team.quarterBudget === undefined) {
                team.quarterBudget = state.config.quarterBudget || 0;
                needsSave = true;
            }
        });

        // 4. currentTeamId 복원
        if (data.currentTeamId && state.teams.some(t => t.id === data.currentTeamId)) {
            state.currentTeamId = data.currentTeamId;
        } else if (state.teams.length > 0) {
            // 첫 번째 팀을 기본 선택
            state.currentTeamId = state.teams[0].id;
        }

        if (needsSave) {
            saveToStorage();
        }
    }

    // 현재 월에 맞는 분기 자동 선택
    const currentMonth = new Date().getMonth() + 1;
    state.currentQuarter = Math.ceil(currentMonth / 3);

    // 첫 번째 팀을 기본 선택 (팀이 있고 선택된 팀이 없는 경우)
    if (state.teams.length > 0 && !state.currentTeamId) {
        state.currentTeamId = state.teams[0].id;
    }
    document.getElementById('quarterSelect').value = state.currentQuarter;
}

// 로컬 스토리지에 데이터 저장
function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        members: state.members,
        expenses: state.expenses,
        subscriptions: state.subscriptions,
        teams: state.teams,
        config: state.config,
        currentTeamId: state.currentTeamId
    }));
}

// 분기 변경
function changeQuarter() {
    const select = document.getElementById('quarterSelect');
    state.currentQuarter = select.value === 'all' ? 'all' : parseInt(select.value);
    updateFilterMonths();
    renderAll();
}

// 팀 변경
function changeTeam(teamId) {
    state.currentTeamId = Number(teamId);
    saveToStorage();
    renderAll();

    // 드롭다운 닫기
    const dropdown = document.querySelector('.title-dropdown');
    if (dropdown) dropdown.classList.remove('active');
}

// 헤더 팀 선택 드롭다운 토글
function toggleTeamDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.querySelector('.title-dropdown');
    dropdown.classList.toggle('active');
}

// 헤더 팀 선택 메뉴 업데이트 (커스텀 드롭다운)
function updateHeaderTeamSelect() {
    const menuContainer = document.getElementById('teamDropdownMenu');
    if (!menuContainer) return;

    if (state.teams.length === 0) {
        menuContainer.innerHTML = '<div class="dropdown-item">등록된 팀 없음</div>';
        return;
    }

    menuContainer.innerHTML = state.teams.map(t => `
        <div class="dropdown-item ${t.id === state.currentTeamId ? 'active' : ''}" 
             onclick="changeTeam(${t.id})">
            ${t.name}
        </div>
    `).join('');
}

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', function (e) {
    const dropdown = document.querySelector('.title-dropdown');
    if (dropdown && dropdown.classList.contains('active') && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// 필터 월 옵션 업데이트
function updateFilterMonths() {
    const filterMonth = document.getElementById('filterMonth');
    const months = QUARTER_MONTHS[state.currentQuarter];

    filterMonth.innerHTML = '<option value="all">전체 월</option>';
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = MONTH_NAMES[month];
        filterMonth.appendChild(option);
    });
}

// 현재 팀의 예산 가져오기
function getCurrentTeamBudget() {
    if (!state.currentTeamId) return 0;
    const team = state.teams.find(t => t.id === state.currentTeamId);
    return team ? (team.quarterBudget || 0) : 0;
}

// 현재 팀의 멤버 ID 목록 가져오기
function getCurrentTeamMemberIds() {
    if (!state.currentTeamId) return [];
    return state.members
        .filter(m => m.teamId === state.currentTeamId)
        .map(m => m.id);
}

// 현재 분기의 지출 + 구독 계산 데이터 가져오기 (현재 팀 기준)
function getQuarterExpenses() {
    const months = QUARTER_MONTHS[state.currentQuarter];
    const year = new Date().getFullYear();
    const teamMemberIds = getCurrentTeamMemberIds();

    // 일반 지출 필터링 (현재 팀 멤버의 지출만)
    const regularExpenses = state.expenses.filter(expense => {
        const expenseMonth = new Date(expense.date).getMonth() + 1;
        const expenseYear = new Date(expense.date).getFullYear();
        const isInTeam = teamMemberIds.includes(expense.memberId);
        return isInTeam && expenseYear === year && months.includes(expenseMonth);
    });

    // 구독 서비스: 각 월마다 가상의 지출로 계산 (현재 팀 멤버의 구독만)
    const subscriptionExpenses = [];
    state.subscriptions
        .filter(sub => teamMemberIds.includes(sub.memberId))
        .forEach(sub => {
            months.forEach(month => {
                // 해당 월에 이미 확정된 지출이 있는지 확인
                const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
                const isConfirmed = state.expenses.some(e =>
                    e.subscriptionId === sub.id &&
                    e.subscriptionMonth === yearMonth
                );

                if (!isConfirmed) {
                    // 결제일 계산 (기존 생성일의 '일' 사용)
                    const createdDay = new Date(sub.createdAt).getDate();
                    const paymentDate = new Date(year, month - 1, createdDay);
                    const today = new Date();

                    // 만약 생성일이 말일이라서 현재 월에 해당 일자가 없다면 말일로 조정 (예: 31일 -> 2월 28일)
                    if (paymentDate.getMonth() !== month - 1) {
                        paymentDate.setDate(0); // 전달 말일(=이번달 0일)인데 로직상 좀 복잡하니 단순화
                        // JS Date setDate(0)는 전달 마지막날. 
                        // 그냥 해당 월의 마지막 날짜를 구해서 비교하는게 나음.
                    }

                    // 정확한 날짜 재계산
                    const lastDayOfMonth = new Date(year, month, 0).getDate();
                    const targetDay = Math.min(createdDay, lastDayOfMonth);
                    const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
                    const targetDateObj = new Date(targetDateStr);

                    // 결제일이 지났는지 여부
                    const isDue = targetDateObj <= today;

                    subscriptionExpenses.push({
                        ...sub,
                        id: `sub-${sub.id}-${month}`,
                        originalId: sub.id, // 원본 ID 유지
                        date: targetDateStr,
                        isVirtual: true, // 가상 지출 표시
                        isDue: isDue, // 결제일 도래/경과 여부
                        subscriptionMonth: yearMonth
                    });
                }
            });
        });

    return [...regularExpenses, ...subscriptionExpenses];
}

// ============ 환율 API ============
async function fetchExchangeRate() {
    const rateElement = document.getElementById('exchangeRate');
    rateElement.textContent = '로딩중...';

    try {
        // 무료 환율 API 사용 (exchangerate-api.com)
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        state.exchangeRate = data.rates.KRW;
        rateElement.textContent = `₩${state.exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`;
        showToast('환율이 업데이트되었습니다.', 'success');
    } catch (error) {
        console.error('환율 조회 실패:', error);
        rateElement.textContent = `₩${state.exchangeRate.toLocaleString('ko-KR')} (기본값)`;
        showToast('환율 조회에 실패했습니다. 기본값을 사용합니다.', 'error');
    }
}

// ============ 탭 관리 ============
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 탭 활성화
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 컨텐츠 표시
            const tabId = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// ============ 폼 초기화 ============
function initForms() {
    // 팀원 등록 폼
    document.getElementById('memberForm').addEventListener('submit', handleMemberSubmit);

    // 비용 등록 폼
    document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);

    // 설정 폼
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);

    // 팀 등록 폼
    document.getElementById('teamForm').addEventListener('submit', handleTeamSubmit);

    // 통화 선택 변경 시 환산 금액 표시
    document.getElementById('expenseCurrency').addEventListener('change', updateConvertedAmount);
    document.getElementById('expenseAmount').addEventListener('input', updateConvertedAmount);

    // 카테고리 변경 시 구독 옵션 표시/숨김
    document.getElementById('expenseCategory').addEventListener('change', toggleSubscriptionOption);
}

// ============ 설정 관리 ============
function openSettingsModal() {
    // 현재 선택된 팀의 예산 표시
    const currentTeam = state.teams.find(t => t.id === state.currentTeamId);
    const teamNameDisplay = document.getElementById('settingTeamName');

    if (currentTeam) {
        // select를 읽기 전용 표시로 변경
        teamNameDisplay.innerHTML = `<option value="${currentTeam.id}" selected>${currentTeam.name}</option>`;
        teamNameDisplay.disabled = true;
        document.getElementById('settingBudget').value = currentTeam.quarterBudget || 0;
    } else {
        teamNameDisplay.innerHTML = '<option value="">팀을 먼저 선택해주세요</option>';
        teamNameDisplay.disabled = true;
        document.getElementById('settingBudget').value = 0;
    }

    document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function handleSettingsSubmit(e) {
    e.preventDefault();

    if (!state.currentTeamId) {
        showToast('상단에서 팀을 먼저 선택해주세요.', 'error');
        return;
    }

    const budget = parseInt(document.getElementById('settingBudget').value);

    if (isNaN(budget) || budget < 0) {
        showToast('올바른 예산을 입력해주세요.', 'error');
        return;
    }

    // 현재 팀의 예산 업데이트
    const team = state.teams.find(t => t.id === state.currentTeamId);
    if (team) {
        team.quarterBudget = budget;
    }

    saveToStorage();
    renderAll();
    closeSettingsModal();
    showToast('예산이 저장되었습니다.', 'success');
}

// 팀 관리 로직
function openTeamModal() {
    const modal = document.getElementById('teamModal');
    modal.style.display = ''; // 기존 inline style 제거
    modal.classList.add('active');
    renderTeamList();
    document.getElementById('newTeamName').focus();
}

function closeTeamModal() {
    const modal = document.getElementById('teamModal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = ''; // 애니메이션 후 정리
    }, 200);
}

function handleTeamSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('newTeamName');
    const name = nameInput.value.trim();

    if (name) {
        if (state.teams.some(t => t.name === name)) {
            showToast('이미 존재하는 팀 이름입니다.', 'error');
            return;
        }

        state.teams.push({
            id: Date.now(),
            name: name
        });
        saveToStorage();
        renderTeamList();
        renderTeamSelect(); // 멤버 폼의 Select 업데이트
        nameInput.value = '';
        showToast('팀이 추가되었습니다.', 'success');
    }
}

function deleteTeam(id) {
    if (confirm('팀을 삭제하시겠습니까?\n해당 팀에 소속된 멤버는 "미지정" 상태가 됩니다.')) {
        state.teams = state.teams.filter(t => t.id !== id);
        // 멤버들의 teamId 제거
        state.members.forEach(m => {
            if (m.teamId === id) {
                m.teamId = null;
            }
        });
        saveToStorage();
        renderTeamList();
        renderTeamSelect();
        renderMembers(); // 멤버 목록 갱신 (팀 이름 표시 제거)
        showToast('팀이 삭제되었습니다.', 'success');
    }
}

function renderTeamList() {
    const list = document.getElementById('teamList');

    if (state.teams.length === 0) {
        list.innerHTML = '<p class="empty-state">등록된 팀이 없습니다.</p>';
        return;
    }

    let html = `
        <table class="settings-table">
            <thead>
                <tr>
                    <th>팀명</th>
                    <th style="width: 140px; text-align: center;">관리</th>
                </tr>
            </thead>
            <tbody>
    `;

    html += state.teams.map(team => {
        // 수정 모드인지 확인 (state에 editingTeamId가 있다고 가정)
        if (state.editingTeamId === team.id) {
            return `
                <tr>
                    <td>
                        <input type="text" id="edit-team-${team.id}" value="${team.name}" 
                               onkeydown="if(event.key === 'Enter') updateTeam(${team.id})">
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-sm btn-save" onclick="updateTeam(${team.id})">저장</button>
                            <button class="btn btn-sm btn-cancel" onclick="cancelEdit()">취소</button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            return `
                <tr>
                    <td>${team.name}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-sm btn-edit" onclick="editTeam(${team.id})">수정</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteTeam(${team.id})">삭제</button>
                        </div>
                    </td>
                </tr>
            `;
        }
    }).join('');

    html += `
            </tbody>
        </table>
    `;

    list.innerHTML = html;
}

// 팀 수정 모드 진입
function editTeam(id) {
    state.editingTeamId = id;
    renderTeamList();
    // 포커스 이동
    setTimeout(() => {
        const input = document.getElementById(`edit-team-${id}`);
        if (input) input.focus();
    }, 0);
}

// 팀 수정 취소
function cancelEdit() {
    state.editingTeamId = null;
    renderTeamList();
}

// 팀 수정 저장
function updateTeam(id) {
    const input = document.getElementById(`edit-team-${id}`);
    const newName = input.value.trim();

    if (!newName) {
        showToast('팀 이름을 입력해주세요.', 'error');
        return;
    }

    if (state.teams.some(t => t.name === newName && t.id !== id)) {
        showToast('이미 존재하는 팀 이름입니다.', 'error');
        return;
    }

    // 팀 이름 업데이트
    const team = state.teams.find(t => t.id === id);
    if (team) {
        team.name = newName;
        state.editingTeamId = null;
        saveToStorage();
        renderTeamList();
        renderTeamSelect(); // 멤버폼 갱신
        renderMembers(); // 멤버리스트 갱신 (팀명이 바뀌었으므로)
        updateHeaderTeamSelect(); // 헤더 드롭다운 갱신

        // 만약 현재 선택된 팀이라면 헤더 타이틀도 업데이트
        if (state.currentTeamId === id) {
            updateHeader();
        }

        showToast('팀 이름이 수정되었습니다.', 'success');
    }
}

function renderTeamSelect() {
    const select = document.getElementById('memberTeam');
    if (!select) return; // 요소가 없는 경우 방어

    const currentVal = select.value;
    select.innerHTML = '<option value="">팀 선택 (미지정)</option>' +
        state.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    // 가능한 경우 값 유지
    if (currentVal && state.teams.some(t => t.id == currentVal)) {
        select.value = currentVal;
    }

    // 변경 시 팀원 목록 필터와 동기화
    select.onchange = function () {
        const filterSelect = document.getElementById('memberListTeamFilter');
        if (filterSelect) {
            filterSelect.value = this.value;
            renderMemberList();
        }
    };
}

// 구독 옵션 표시/숨김
function toggleSubscriptionOption() {
    const category = document.getElementById('expenseCategory').value;
    const subscriptionOption = document.getElementById('subscriptionOption');
    const isSubscriptionCheckbox = document.getElementById('isSubscription');

    if (category === '구독서비스') {
        subscriptionOption.style.display = 'block';
    } else {
        subscriptionOption.style.display = 'none';
        isSubscriptionCheckbox.checked = false;
    }
}

// 기본 날짜 설정
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
}

// ============ 팀원 관리 ============
function handleMemberSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('memberName').value.trim();
    const role = document.getElementById('memberRole').value.trim();
    const teamSelect = document.getElementById('memberTeam'); // 팀 선택

    if (!name) {
        showToast('이름을 입력해주세요.', 'error');
        return;
    }

    const teamId = teamSelect.value ? Number(teamSelect.value) : null;

    const member = {
        id: Date.now(),
        name,
        role: role || '팀원',
        teamId: teamId
    };

    state.members.push(member);
    saveToStorage();

    // 폼 초기화
    document.getElementById('memberForm').reset();

    renderAll();
    showToast(`${name}님이 팀원으로 등록되었습니다.`, 'success');
}

function deleteMember(id) {
    const member = state.members.find(m => m.id === id);
    if (!member) return;

    if (confirm(`${member.name}님을 삭제하시겠습니까?\n해당 팀원의 지출 내역도 함께 삭제됩니다.`)) {
        state.members = state.members.filter(m => m.id !== id);
        state.expenses = state.expenses.filter(e => e.memberId !== id);
        saveToStorage();
        renderAll();
        showToast('팀원이 삭제되었습니다.', 'success');
    }
}

function renderMemberList() {
    const container = document.getElementById('memberList');
    const filterSelect = document.getElementById('memberListTeamFilter');

    // 팀 필터 드롭다운 업데이트
    if (filterSelect) {
        const currentFilterVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">팀 선택</option>' +
            state.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        // 가능한 경우 이전 선택값 유지
        if (currentFilterVal && state.teams.some(t => t.id == currentFilterVal)) {
            filterSelect.value = currentFilterVal;
        }
    }

    // 팀이 선택되지 않은 경우
    const selectedTeamId = filterSelect ? filterSelect.value : '';

    // 팀원 등록 폼의 팀 선택도 동기화
    const memberTeamSelect = document.getElementById('memberTeam');
    if (memberTeamSelect && selectedTeamId) {
        memberTeamSelect.value = selectedTeamId;
    }

    if (!selectedTeamId) {
        container.innerHTML = '<p class="empty-state">팀을 선택해주세요.</p>';
        return;
    }

    // 선택된 팀의 멤버만 필터링
    const filteredMembers = state.members.filter(m => m.teamId == selectedTeamId);

    if (filteredMembers.length === 0) {
        container.innerHTML = '<p class="empty-state">해당 팀에 등록된 팀원이 없습니다.</p>';
        return;
    }

    container.innerHTML = filteredMembers.map(member => {
        const initial = member.name.charAt(0);
        const memberExpenses = state.expenses.filter(e => e.memberId === member.id);
        const totalUsed = memberExpenses.reduce((sum, e) => sum + e.amountKRW, 0);

        const team = state.teams.find(t => t.id === member.teamId);
        const teamBadge = team ? `<span class="team-badge">${team.name}</span>` : '';

        return `
            <div class="member-card">
                <div class="info">
                    <div class="avatar">${initial}</div>
                    <div class="details">
                        <div class="name">${member.name}</div>
                        <div class="member-meta">
                            ${teamBadge}
                            <span class="role">${member.role}</span>
                            <span>· 사용: ₩${totalUsed.toLocaleString('ko-KR')}</span>
                        </div>
                    </div>
                </div>
                <div class="actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteMember(${member.id})">삭제</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateMemberSelect() {
    const selects = [
        document.getElementById('expenseMember'),
        document.getElementById('filterMember')
    ];

    selects.forEach(select => {
        const currentValue = select.value;
        const isFilter = select.id === 'filterMember';

        select.innerHTML = isFilter
            ? '<option value="all">전체 팀원</option>'
            : '<option value="">팀원 선택</option>';

        state.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            select.appendChild(option);
        });

        // 이전 선택값 복원
        if (currentValue && [...select.options].some(o => o.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

// ============ 비용 관리 ============
function handleExpenseSubmit(e) {
    e.preventDefault();

    const memberId = parseInt(document.getElementById('expenseMember').value);
    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value.trim();
    const currency = document.getElementById('expenseCurrency').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const isSubscription = document.getElementById('isSubscription').checked;

    if (!memberId || !date || !category || !description || !amount) {
        showToast('모든 필드를 입력해주세요.', 'error');
        return;
    }

    const amountKRW = currency === 'USD'
        ? Math.round(amount * state.exchangeRate)
        : amount;

    // 구독 서비스인 경우 subscriptions 배열에 추가 (매월 자동 반영)
    if (category === '구독서비스' && isSubscription) {
        const subscription = {
            id: Date.now(),
            memberId,
            category,
            description,
            currency,
            amount,
            amountKRW,
            exchangeRateUsed: currency === 'USD' ? state.exchangeRate : null,
            isSubscription: true,
            createdAt: date
        };
        state.subscriptions.push(subscription);
        showToast(`월 정기 구독이 등록되었습니다. (매월 ${currency === 'USD' ? '$' + amount : '₩' + amountKRW.toLocaleString('ko-KR')})`, 'success');
    } else {
        const expense = {
            id: Date.now(),
            memberId,
            date,
            category,
            description,
            currency,
            amount,
            amountKRW,
            exchangeRateUsed: currency === 'USD' ? state.exchangeRate : null,
            isSubscription: false
        };
        state.expenses.push(expense);
        showToast('비용이 등록되었습니다.', 'success');
    }

    saveToStorage();

    // 폼 초기화 (날짜와 팀원은 유지)
    document.getElementById('expenseCategory').value = '';
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseCurrency').value = 'KRW';
    document.getElementById('convertedAmount').style.display = 'none';
    document.getElementById('subscriptionOption').style.display = 'none';
    document.getElementById('isSubscription').checked = false;

    renderAll();
}

function updateConvertedAmount() {
    const currency = document.getElementById('expenseCurrency').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    const convertedDiv = document.getElementById('convertedAmount');
    const convertedValue = document.getElementById('convertedValue');

    if (currency === 'USD' && amount > 0) {
        const krwAmount = Math.round(amount * state.exchangeRate);
        convertedValue.textContent = `₩${krwAmount.toLocaleString('ko-KR')}`;
        convertedDiv.style.display = 'flex';
    } else {
        convertedDiv.style.display = 'none';
    }
}

// 기존 구독 항목을 월 정기 구독으로 전환
function convertToSubscription(id) {
    const expense = state.expenses.find(e => e.id === id);
    if (!expense) return;

    if (!confirm(`"${expense.description}"을(를) 월 정기 구독으로 전환하시겠습니까?\n매월 자동으로 비용이 반영됩니다.`)) {
        return;
    }

    // 구독으로 추가
    const subscription = {
        id: Date.now(),
        memberId: expense.memberId,
        category: expense.category,
        description: expense.description,
        currency: expense.currency,
        amount: expense.amount,
        amountKRW: expense.amountKRW,
        exchangeRateUsed: expense.exchangeRateUsed,
        isSubscription: true,
        createdAt: expense.date
    };
    state.subscriptions.push(subscription);

    // 기존 일반 지출 삭제
    state.expenses = state.expenses.filter(e => e.id !== id);

    saveToStorage();
    renderAll();
    showToast(`"${expense.description}"이(가) 월 정기 구독으로 전환되었습니다.`, 'success');
}

// 구독 삭제
function deleteSubscription(id) {
    const subscription = state.subscriptions.find(s => s.id === id);
    if (!subscription) return;

    if (confirm(`"${subscription.description}" 월 정기 구독을 삭제하시겠습니까?`)) {
        state.subscriptions = state.subscriptions.filter(s => s.id !== id);
        saveToStorage();
        renderAll();
        showToast('월 정기 구독이 삭제되었습니다.', 'success');
    }
}

// 구독 결제 확정 (환율 적용하여 실제 지출로 변환)
function confirmSubscription(subId, dateStr, originalId) {
    const subscription = state.subscriptions.find(s => s.id === originalId);
    if (!subscription) return;

    if (!confirm(`${dateStr} 결제 건을 확정하시겠습니까?\n현재 환율(₩${state.exchangeRate.toLocaleString('ko-KR')})이 적용됩니다.`)) {
        return;
    }

    const amountKRW = subscription.currency === 'USD'
        ? Math.round(subscription.amount * state.exchangeRate)
        : subscription.amount;

    // 'YYYY-MM' 형식 추출
    const subscriptionMonth = dateStr.substring(0, 7);

    const expense = {
        id: Date.now(),
        memberId: subscription.memberId,
        date: dateStr,
        category: subscription.category,
        description: `${subscription.description} (정기결제)`,
        currency: subscription.currency,
        amount: subscription.amount,
        amountKRW: amountKRW,
        exchangeRateUsed: state.exchangeRate,
        isSubscription: true,
        subscriptionId: subscription.id, // 어떤 구독에서 왔는지
        subscriptionMonth: subscriptionMonth // 어느 달 분인지
    };

    state.expenses.push(expense);
    saveToStorage();
    renderAll();
    showToast('구독 결제가 확정되었습니다.', 'success');
}

function deleteExpense(id) {
    const expense = state.expenses.find(e => e.id === id);
    if (!expense) return;

    if (confirm('이 지출 내역을 삭제하시겠습니까?')) {
        state.expenses = state.expenses.filter(e => e.id !== id);
        saveToStorage();
        renderAll();
        showToast('지출 내역이 삭제되었습니다.', 'success');
    }
}

// ============ 필터 ============
function initFilters() {
    document.getElementById('filterMonth').addEventListener('change', renderExpenseTable);
    document.getElementById('filterMember').addEventListener('change', renderExpenseTable);
    document.getElementById('filterCategory').addEventListener('change', renderExpenseTable);
}

function getFilteredExpenses() {
    const monthFilter = document.getElementById('filterMonth').value;
    const memberFilter = document.getElementById('filterMember').value;
    const categoryFilter = document.getElementById('filterCategory').value;

    // 현재 분기의 지출 + 구독 데이터 가져오기
    const allExpenses = getQuarterExpenses();

    return allExpenses.filter(expense => {
        const expenseMonth = new Date(expense.date).getMonth() + 1;

        if (monthFilter !== 'all' && expenseMonth !== parseInt(monthFilter)) return false;
        if (memberFilter !== 'all' && expense.memberId !== parseInt(memberFilter)) return false;
        if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;

        return true;
    });
}

// ============ 렌더링 ============
function renderAll() {
    updateHeaderTeamSelect(); // 헤더 팀 드롭다운 업데이트
    renderMemberList();
    if (document.getElementById('memberTeam')) renderTeamSelect(); // 팀 목록 갱신
    updateMemberSelect();
    updateFilterMonths();
    renderDashboard();
    renderExpenseTable();
    updateHeader();
}

function updateHeader() {
    // 현재 선택된 팀 이름으로 타이틀 업데이트
    const currentTeam = state.teams.find(t => t.id === state.currentTeamId);
    const teamName = currentTeam ? currentTeam.name : '팀 운영비 관리';
    document.getElementById('teamTitle').textContent = teamName + ' 운영비';
    document.title = teamName + ' 운영비 관리';
}

function renderDashboard() {
    renderBudgetOverview();
    renderMonthlyBars();
    renderQuarterSummary();
    renderMemberUsage();
    renderRecentExpenses();
}

function renderBudgetOverview() {
    const quarterExpenses = getQuarterExpenses();
    const totalUsed = quarterExpenses.reduce((sum, e) => sum + e.amountKRW, 0);

    // 현재 팀의 분기 예산
    const teamBudget = getCurrentTeamBudget();

    // 예산 계산 (전체 선택 시 연간 예산)
    const isYearly = state.currentQuarter === 'all';
    const budget = isYearly ? teamBudget * 4 : teamBudget;
    const remaining = budget - totalUsed;

    // 라벨 업데이트
    document.getElementById('budgetLabel').textContent = isYearly ? '연간 예산' : '분기 예산';
    document.getElementById('budgetAmount').textContent = `₩${budget.toLocaleString('ko-KR')}`;
    document.getElementById('totalUsed').textContent = `₩${totalUsed.toLocaleString('ko-KR')}`;
    document.getElementById('totalRemaining').textContent = `₩${remaining.toLocaleString('ko-KR')}`;

    // 잔여 금액 색상 변경
    const remainingEl = document.getElementById('totalRemaining');
    if (remaining < 0) {
        remainingEl.style.color = '#f87171';
    } else if (remaining < budget * 0.2) {
        remainingEl.style.color = '#fbbf24';
    } else {
        remainingEl.style.color = '#34d399';
    }
}

function renderMonthlyBars() {
    const container = document.getElementById('monthlyBars');
    const months = QUARTER_MONTHS[state.currentQuarter];
    const teamBudget = getCurrentTeamBudget();
    const monthlyBudget = teamBudget / 3;

    // 현재 분기의 지출 데이터
    const quarterExpenses = getQuarterExpenses();

    // 월별 사용량 계산
    const monthlyUsage = {};
    months.forEach(m => monthlyUsage[m] = 0);

    quarterExpenses.forEach(expense => {
        const month = new Date(expense.date).getMonth() + 1;
        if (months.includes(month)) {
            monthlyUsage[month] += expense.amountKRW;
        }
    });

    const usageValues = Object.values(monthlyUsage);
    const maxUsage = Math.max(...usageValues, monthlyBudget);

    container.innerHTML = months.map(month => {
        const usage = monthlyUsage[month];
        const percentage = (usage / maxUsage) * 100;

        return `
            <div class="month-bar">
                <div class="bar-container">
                    <div class="bar-fill" style="height: ${percentage}%"></div>
                </div>
                <span class="bar-label">${MONTH_NAMES[month]}</span>
                <span class="bar-value">₩${(usage / 1000).toFixed(0)}K</span>
            </div>
        `;
    }).join('');
}

function renderQuarterSummary() {
    const quarterExpenses = getQuarterExpenses();
    const totalUsed = quarterExpenses.reduce((sum, e) => sum + e.amountKRW, 0);
    const teamBudget = getCurrentTeamBudget();
    const isYearly = state.currentQuarter === 'all';
    const budget = isYearly ? teamBudget * 4 : teamBudget;
    const percentage = budget > 0 ? Math.min((totalUsed / budget) * 100, 100) : 0;
    const circumference = 283; // 2 * PI * 45
    const offset = circumference - (percentage / 100) * circumference;

    document.getElementById('progressCircle').style.strokeDashoffset = offset;
    document.getElementById('usagePercent').textContent = `${percentage.toFixed(1)}%`;

    // 색상 변경
    const progressCircle = document.getElementById('progressCircle');
    if (percentage >= 100) {
        progressCircle.style.stroke = '#ef4444';
    } else if (percentage >= 80) {
        progressCircle.style.stroke = '#f59e0b';
    } else {
        progressCircle.style.stroke = '#6366f1';
    }
}

function renderMemberUsage() {
    const container = document.getElementById('memberUsage');

    if (state.members.length === 0) {
        container.innerHTML = '<p class="empty-state">등록된 팀원이 없습니다.</p>';
        return;
    }

    const quarterExpenses = getQuarterExpenses();
    const memberUsages = state.members.map(member => {
        const totalUsed = quarterExpenses
            .filter(e => e.memberId === member.id)
            .reduce((sum, e) => sum + e.amountKRW, 0);
        return { ...member, totalUsed };
    }).sort((a, b) => b.totalUsed - a.totalUsed);

    const maxUsage = Math.max(...memberUsages.map(m => m.totalUsed), 1);

    container.innerHTML = memberUsages.map(member => {
        const percentage = (member.totalUsed / maxUsage) * 100;
        return `
            <div class="member-usage-item">
                <div class="member-info">
                    <span class="name">${member.name}</span>
                    <span class="amount">₩${member.totalUsed.toLocaleString('ko-KR')}</span>
                </div>
                <div class="usage-bar">
                    <div class="usage-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentExpenses() {
    const container = document.getElementById('recentExpenses');
    const quarterExpenses = getQuarterExpenses();

    if (quarterExpenses.length === 0 && state.subscriptions.length === 0) {
        container.innerHTML = '<p class="empty-state">등록된 지출이 없습니다.</p>';
        return;
    }

    // 최근 지출 (구독 포함)
    const recentExpenses = [...quarterExpenses]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    let html = recentExpenses.map(expense => {
        const member = state.members.find(m => m.id === expense.memberId);
        const memberName = member ? member.name : '알 수 없음';
        const subscriptionBadge = expense.isSubscription ? '<span class="subscription-badge">월정기</span>' : '';

        return `
            <div class="expense-item">
                <div class="info">
                    <span class="category-badge">${expense.category}</span>
                    <div>
                        <div class="description">${expense.description}${subscriptionBadge}</div>
                        <div class="member">${memberName} · ${expense.date}</div>
                    </div>
                </div>
                <div class="amount">₩${expense.amountKRW.toLocaleString('ko-KR')}</div>
            </div>
        `;
    }).join('');



    container.innerHTML = html;
}

function renderExpenseTable() {
    const tbody = document.getElementById('expenseTableBody');
    const filteredExpenses = getFilteredExpenses();

    if (filteredExpenses.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">조건에 맞는 지출 내역이 없습니다.</td>
            </tr>
        `;
        document.getElementById('filteredTotal').textContent = '₩0';
        return;
    }

    // 날짜순 정렬 (최신순)
    const sortedExpenses = [...filteredExpenses].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    tbody.innerHTML = sortedExpenses.map(expense => {
        const member = state.members.find(m => m.id === expense.memberId);
        const memberName = member ? member.name : '알 수 없음';

        const amountDisplay = expense.currency === 'USD'
            ? `$${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span class="currency-tag">USD</span><br><small style="color: var(--text-light)">₩${expense.amountKRW.toLocaleString('ko-KR')}</small>`
            : `₩${expense.amountKRW.toLocaleString('ko-KR')}`;

        const subscriptionBadge = expense.isSubscription ? '<span class="subscription-badge">월정기</span>' : '';

        // 구독 서비스인데 아직 월정기가 아닌 경우 전환 버튼 표시 (일반 지출인 경우)
        const canConvert = expense.category === '구독서비스' && !expense.isSubscription && !expense.isVirtual;
        const convertButton = canConvert
            ? `<button class="btn btn-secondary btn-sm" onclick="convertToSubscription(${expense.id})">월정기</button>`
            : '';

        // 가상 지출(구독)인 경우: 결제일이 지났으면 '확정' 버튼, 아니면 '예정' 표시
        let actionButtons = '';
        if (expense.isVirtual) {
            if (expense.isDue) {
                // 인자를 문자열로 안전하게 전달하기 위해 따옴표 처리 주의
                actionButtons = `<button class="btn btn-primary btn-sm" onclick="confirmSubscription('${expense.id}', '${expense.date}', ${expense.originalId})">결제확정</button>`;
            } else {
                actionButtons = `<span class="status-badge pending">예정</span>`;
            }
        } else {
            // 일반 지출 또는 확정된 지출
            actionButtons = `
                ${convertButton}
                <button class="btn btn-danger btn-sm" onclick="deleteExpense(${expense.id})">삭제</button>
            `;
        }

        return `
            <tr class="${expense.isVirtual ? 'virtual-row' : ''} ${expense.isDue ? 'due-row' : ''}">
                <td>${expense.date}</td>
                <td>${memberName}</td>
                <td>${expense.category}${subscriptionBadge}</td>
                <td>${expense.description}</td>
                <td>${amountDisplay}</td>
                <td>
                    ${actionButtons}
                </td>
            </tr>
        `;
    }).join('');

    // 필터 결과 합계
    const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amountKRW, 0);
    document.getElementById('filteredTotal').textContent = `₩${filteredTotal.toLocaleString('ko-KR')}`;
}

// ============ 데이터 내보내기/가져오기 ============
function exportData() {
    const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        members: state.members,
        expenses: state.expenses,
        config: state.config
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `팀운영비_백업_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('데이터가 내보내기 되었습니다.', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // 데이터 유효성 검사
            if (!data.members || !data.expenses) {
                throw new Error('유효하지 않은 데이터 형식입니다.');
            }

            // 기존 데이터와 병합할지 대체할지 확인
            const hasExistingData = state.members.length > 0 || state.expenses.length > 0;

            if (hasExistingData) {
                const choice = confirm(
                    '기존 데이터가 있습니다.\n\n' +
                    '확인: 기존 데이터를 덮어씁니다.\n' +
                    '취소: 가져오기를 중단합니다.'
                );

                if (!choice) {
                    event.target.value = '';
                    return;
                }
            }

            // 데이터 적용
            state.members = data.members;
            state.expenses = data.expenses;
            state.subscriptions = data.subscriptions || [];
            state.teams = data.teams || []; // 팀 데이터 로드
            if (data.config) {
                state.config = data.config;
            }
            saveToStorage();
            renderAll();

            const memberCount = data.members.length;
            const expenseCount = data.expenses.length;
            const subCount = state.subscriptions.length;
            showToast(`데이터를 가져왔습니다. (팀원 ${memberCount}명, 지출 ${expenseCount}건, 구독 ${subCount}건)`, 'success');
        } catch (error) {
            console.error('데이터 가져오기 실패:', error);
            showToast('데이터 가져오기에 실패했습니다. 파일 형식을 확인해주세요.', 'error');
        }

        // 파일 입력 초기화
        event.target.value = '';
    };

    reader.readAsText(file);
}

// 엑셀 내보내기 (SheetJS 사용)
function exportToExcel() {
    try {
        // XLSX 라이브러리 체크
        if (typeof XLSX === 'undefined') {
            showToast('엑셀 라이브러리를 불러오지 못했습니다. 페이지를 새로고침 해주세요.', 'error');
            return;
        }

        // 워크북 생성
        const wb = XLSX.utils.book_new();

        // ========== 시트 1: 지출 내역 ==========
        const expenseData = state.expenses.map(expense => {
            const member = state.members.find(m => m.id === expense.memberId);
            const team = member && member.teamId ? state.teams.find(t => t.id === member.teamId) : null;

            return {
                '날짜': expense.date,
                '팀명': team ? team.name : '-',
                '이름': member ? member.name : '(삭제됨)',
                '카테고리': expense.category,
                '내용': expense.description,
                '금액(원화)': expense.amountKRW,
                '원본금액': expense.amount,
                '통화': expense.currency,
                '적용환율': expense.exchangeRateUsed || '-',
                '구독': expense.isSubscription ? 'Y' : 'N'
            };
        });

        // 날짜순 정렬 (최신순)
        expenseData.sort((a, b) => new Date(b['날짜']) - new Date(a['날짜']));

        if (expenseData.length > 0) {
            const wsExpenses = XLSX.utils.json_to_sheet(expenseData);
            wsExpenses['!cols'] = [
                { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
                { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 6 },
                { wch: 10 }, { wch: 6 }
            ];
            XLSX.utils.book_append_sheet(wb, wsExpenses, "지출내역");
        }

        // ========== 시트 2: 팀원별 요약 ==========
        const memberSummary = state.members.map(member => {
            const team = member.teamId ? state.teams.find(t => t.id === member.teamId) : null;
            const memberExpenses = state.expenses.filter(e => e.memberId === member.id);
            const totalKRW = memberExpenses.reduce((sum, e) => sum + e.amountKRW, 0);

            // 카테고리별 집계
            const categoryTotals = {};
            memberExpenses.forEach(e => {
                categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amountKRW;
            });

            return {
                '팀명': team ? team.name : '-',
                '이름': member.name,
                '직책': member.role,
                '총 사용금액': totalKRW,
                '식비': categoryTotals['식비'] || 0,
                '교통비': categoryTotals['교통비'] || 0,
                '구독서비스': categoryTotals['구독서비스'] || 0,
                '도서구입': categoryTotals['도서구입'] || 0,
                '교육비': categoryTotals['교육비'] || 0,
                '사무용품': categoryTotals['사무용품'] || 0,
                '기타': categoryTotals['기타'] || 0,
                '지출건수': memberExpenses.length
            };
        });

        // 총 사용금액 기준 내림차순 정렬
        memberSummary.sort((a, b) => b['총 사용금액'] - a['총 사용금액']);

        if (memberSummary.length > 0) {
            const wsMemberSummary = XLSX.utils.json_to_sheet(memberSummary);
            wsMemberSummary['!cols'] = [
                { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
                { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
                { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
            ];
            XLSX.utils.book_append_sheet(wb, wsMemberSummary, "팀원별요약");
        }

        // 시트가 하나도 없으면 안내
        if (wb.SheetNames.length === 0) {
            showToast('내보낼 데이터가 없습니다.', 'warning');
            return;
        }

        // 파일 저장
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        XLSX.writeFile(wb, `팀운영비_${state.config.teamName}_${today}.xlsx`);

        showToast('엑셀 파일이 다운로드되었습니다.', 'success');
    } catch (error) {
        console.error('Excel export failed:', error);
        showToast('엑셀 내보내기에 실패했습니다: ' + error.message, 'error');
    }
}

// ============ 유틸리티 ============
function showToast(message, type = 'info') {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 전역 함수 노출 (onclick 핸들러용)
window.deleteMember = deleteMember;
window.deleteExpense = deleteExpense;
window.deleteSubscription = deleteSubscription;
window.convertToSubscription = convertToSubscription;
window.confirmSubscription = confirmSubscription;
window.changeQuarter = changeQuarter;
window.changeTeam = changeTeam;
window.fetchExchangeRate = fetchExchangeRate;
window.exportData = exportData;
window.importData = importData;
window.exportToExcel = exportToExcel;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.openTeamModal = openTeamModal;
window.closeTeamModal = closeTeamModal;
window.deleteTeam = deleteTeam;
window.toggleTeamDropdown = toggleTeamDropdown;
window.editTeam = editTeam;
window.cancelEdit = cancelEdit;
window.updateTeam = updateTeam;

// 모달 배경 클릭 시 닫기
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none'; // Team Modal
        event.target.classList.remove('active'); // Settings Modal
    }
}
