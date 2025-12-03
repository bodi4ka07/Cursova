const BASE_HOST = window.location.host || 'localhost:8080';
const BASE_PROTOCOL = window.location.protocol || 'http:';
const BASE_URL = `${BASE_PROTOCOL}//${BASE_HOST}`;

let allMatches = [];
let currentLeague = null;

const leagueNames = {
  'WC': 'FIFA World Cup',
  'CL': 'UEFA Champions League',
  'EC': 'European Championship',
  'PL': 'Premier League',
  'ELC': 'Championship',
  'PD': 'La Liga',
  'SA': 'Serie A',
  'BL1': 'Bundesliga',
  'FL1': 'Ligue 1',
  'DED': 'Eredivisie',
  'PPL': 'Primeira Liga',
  'BSA': 'Série A'
};

// Ініціалізація теми при завантаженні
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadUpcomingMatches();
});

// === СИСТЕМА ТЕМ ===

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const currentTheme = localStorage.getItem('theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  localStorage.setItem('theme', newTheme);
}

function applyTheme(theme) {
  const themeStylesheet = document.getElementById('theme-stylesheet');
  const themeButton = document.getElementById('currentTheme');
  
  if (theme === 'dark') {
    themeStylesheet.href = 'style-dark.css';
    themeButton.textContent = 'Темна';
  } else {
    themeStylesheet.href = 'style.css';
    themeButton.textContent = 'Світла';
  }
}

function toggleSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('active');
}

// Закрити панель налаштувань при кліку поза нею
document.addEventListener('click', (e) => {
  const panel = document.getElementById('settingsPanel');
  const settingsIcon = document.querySelector('.settings-icon');
  
  if (panel.classList.contains('active') && 
      !panel.contains(e.target) && 
      !settingsIcon.contains(e.target)) {
    panel.classList.remove('active');
  }
});

// === РОЗРАХУНОК ЙМОВІРНОСТІ ПЕРЕМОГИ ===

// Функція для отримання кольору залежно від ймовірності
function getProbabilityColor(probability) {
  if (probability >= 60) return '#28a745'; // Зелений - висока ймовірність
  if (probability >= 45) return '#ffc107'; // Жовтий - середня
  if (probability >= 30) return '#fd7e14'; // Помаранчевий
  return '#dc3545'; // Червоний - низька
}

function calculateWinProbability(homeStats, awayStats) {
  if (!homeStats || !awayStats) {
    return null;
  }
  
  let homeScore = 0;
  let awayScore = 0;
  
  // 1. ПОЗИЦІЯ В ТАБЛИЦІ (45% ваги) - збільшено!
  const totalTeams = 20;
  const homePositionScore = (totalTeams - (homeStats.position || totalTeams)) / totalTeams;
  const awayPositionScore = (totalTeams - (awayStats.position || totalTeams)) / totalTeams;
  
  homeScore += homePositionScore * 45;
  awayScore += awayPositionScore * 45;
  
  // 2. РІЗНИЦЯ ГОЛІВ (30% ваги)
  const homeGoalDiff = (homeStats.goalsFor || 0) - (homeStats.goalsAgainst || 0);
  const awayGoalDiff = (awayStats.goalsFor || 0) - (awayStats.goalsAgainst || 0);
  
  const maxGoalDiff = 25;
  const homeGoalScore = Math.max(-1, Math.min(1, homeGoalDiff / maxGoalDiff));
  const awayGoalScore = Math.max(-1, Math.min(1, awayGoalDiff / maxGoalDiff));
  
  homeScore += (homeGoalScore + 1) * 15;
  awayScore += (awayGoalScore + 1) * 15;
  
  // 3. ОЧКИ НА ГРУ (15% ваги)
  const homePointsPerGame = (homeStats.points || 0) / (homeStats.playedGames || 1);
  const awayPointsPerGame = (awayStats.points || 0) / (awayStats.playedGames || 1);
  
  const maxPointsPerGame = 3;
  homeScore += (homePointsPerGame / maxPointsPerGame) * 15;
  awayScore += (awayPointsPerGame / maxPointsPerGame) * 15;
  
  // 4. ДОМАШНЄ ПОЛЕ (10% ваги)
  homeScore += 10;
  
  // РОЗРАХУНОК БАЗОВИХ ЙМОВІРНОСТЕЙ
  const totalScore = homeScore + awayScore;
  let homeProbability = (homeScore / totalScore) * 100;
  let awayProbability = (awayScore / totalScore) * 100;
  
  // РОЗРАХУНОК ЙМОВІРНОСТІ НІЧИЄЇ (покращена формула)
  const scoreDifference = Math.abs(homeScore - awayScore);
  
  // Базова ймовірність нічиєї залежить від різниці
  let drawProbability;
  
  if (scoreDifference > 30) {
    // Дуже велика різниця 
    drawProbability = 8 + (scoreDifference / 10); // 8-12%
  } else if (scoreDifference > 20) {
    // Велика різниця
    drawProbability = 12 + (scoreDifference / 8); // 12-16%
  } else if (scoreDifference > 10) {
    // Середня різниця
    drawProbability = 16 + (scoreDifference / 5); // 16-20%
  } else if (scoreDifference > 5) {
    // Мала різниця
    drawProbability = 20 + (scoreDifference / 3); // 20-24%
  } else {
    // Дуже близькі команди
    drawProbability = 25 + (5 - scoreDifference); // 25-30%
  }
  
  // Обмежуємо діапазон
  drawProbability = Math.max(8, Math.min(30, Math.round(drawProbability)));
  
  // ПЕРЕРОЗПОДІЛ З УРАХУВАННЯМ НІЧИЄЇ
  const remainingProbability = 100 - drawProbability;
  homeProbability = Math.round((homeProbability / 100) * remainingProbability);
  awayProbability = Math.round((awayProbability / 100) * remainingProbability);
  
  // КОРИГУВАННЯ ДО 100%
  const total = homeProbability + awayProbability + drawProbability;
  const diff = 100 - total;
  
  if (diff !== 0) {
    if (homeProbability >= awayProbability) {
      homeProbability += diff;
    } else {
      awayProbability += diff;
    }
  }
  
  return {
    home: Math.max(0, homeProbability),
    away: Math.max(0, awayProbability),
    draw: drawProbability
  };
}

// Завантаження найближчих матчів для головної сторінки
async function loadUpcomingMatches() {
  const loading = document.getElementById('home-loading');
  const container = document.getElementById('upcoming-matches-container');
  
  try {
    loading.style.display = 'block';
    console.log('🏠 Завантаження найближчих матчів...');
    
    // <<< ЗМІНА: Використовуємо BASE_URL >>>
    const response = await fetch(`${BASE_URL}/upcoming-matches`);
    const data = await response.json();
    
    console.log('📊 Отримано турнірів:', data.competitions?.length || 0);
    
    loading.style.display = 'none';
    
    if (!data.competitions || data.competitions.length === 0) {
      container.innerHTML = '<p class="no-matches">Немає найближчих матчів</p>';
      return;
    }
    
    let html = '<div class="upcoming-matches-grid">';
    
    data.competitions.forEach(comp => {
      console.log(`📋 ${comp.competitionName}: ${comp.matches.length} матчів`);
      comp.matches.forEach(match => {
        const matchDate = new Date(match.utcDate);
        const now = new Date();
        const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
        const isFinished = match.status === 'FINISHED';
        const isFuture = matchDate > now && !isLive;
        
        // ⬇️ ПОКАЗУЄМО ТІЛЬКИ МАЙБУТНІ АБО LIVE МАТЧІ
        if (!isFinished) {
          const homeStats = match.homeTeamStats;
          const awayStats = match.awayTeamStats;
          
          html += `
            <div class="match-card-home ${isLive ? 'live' : ''}" onclick="loadMatchDetails(${match.id})">
              <div class="match-competition">${comp.competitionName}</div>
              
              <div class="match-teams-home">
                <div class="team-home">
                  <img src="${match.homeTeam?.crest || ''}" class="team-logo-home" onerror="this.style.display='none'">
                  <span class="team-name-home">${match.homeTeam?.name || '-'}</span>
                </div>
                
                <div class="match-score-home">
                  ${isLive ? 
                    `<span class="live-badge">LIVE</span>
                     <div class="score-live">${match.score?.fullTime?.home ?? 0} : ${match.score?.fullTime?.away ?? 0}</div>` :
                    `<div class="match-time">${matchDate.toLocaleString('uk-UA', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</div>`
                  }
                </div>
                
                <div class="team-away">
                  <span class="team-name-home">${match.awayTeam?.name || '-'}</span>
                  <img src="${match.awayTeam?.crest || ''}" class="team-logo-home" onerror="this.style.display='none'">
                </div>
              </div>
              
              ${(homeStats && awayStats) ? `
              ${(() => {
                const probability = calculateWinProbability(homeStats, awayStats);
                if (!probability) return '';
                
                return `
                <div class="match-prediction">
                  <div class="prediction-title">📊 Прогноз перемоги:</div>
                  <div class="prediction-bars">
                    <div class="prediction-team">
                      <span class="prediction-label">${match.homeTeam?.shortName || match.homeTeam?.tla || 'Дім'}</span>
                      <div class="prediction-bar-container">
                        <div class="prediction-bar home-bar" style="width: ${probability.home}%; background: ${getProbabilityColor(probability.home)}">
                          <span class="prediction-percent">${probability.home}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div class="prediction-draw">
                      <span class="draw-label">Нічия</span>
                      <span class="draw-percent">${probability.draw}%</span>
                    </div>
                    
                    <div class="prediction-team">
                      <span class="prediction-label">${match.awayTeam?.shortName || match.awayTeam?.tla || 'Гості'}</span>
                      <div class="prediction-bar-container">
                        <div class="prediction-bar away-bar" style="width: ${probability.away}%; background: ${getProbabilityColor(probability.away)}">
                          <span class="prediction-percent">${probability.away}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                `;
              })()}
              
              <div class="match-stats-row">
                <div class="team-stats-section">
                  <div class="team-stat-compact">
                    <span class="stat-label-compact">Місце</span>
                    <span class="stat-value-compact">${homeStats?.position || '-'}</span>
                  </div>
                  <div class="team-stat-compact">
                    <span class="stat-label-compact">Матчі</span>
                    <span class="stat-value-compact">${homeStats?.playedGames || '-'}</span>
                  </div>
                  <div class="team-stat-compact">
                    <span class="stat-label-compact">Голи</span>
                    <span class="stat-value-compact">${homeStats ? `${homeStats.goalsFor}:${homeStats.goalsAgainst}` : '-'}</span>
                  </div>
                  <div class="team-stat-compact">
                    <span class="stat-label-compact">Очки</span>
                    <span class="stat-value-compact">${homeStats?.points || '-'}</span>
                  </div>
                </div>
                
                <div class="team-stats-section">
                  <div class="team-stat-compact">
                    <span class="stat-label-compact">Місце</span>
                    <span class="stat-value-compact">${awayStats?.position || '-'}</span>
                  </div>
                  <div class="team-stat-compact">
                    <span class="stat-label-compact">Матчі</span>
                    <span class="stat-value-compact">${awayStats?.playedGames || '-'}</span>
                  </div>
                  <div class="team-stat-compact">
                    <span class="stat-label-compact">Голи</span>
                    <span class="stat-value-compact">${awayStats ? `${awayStats.goalsFor}:${awayStats.goalsAgainst}` : '-'}</span>
                  </div>
                  <div class="team-stat-compact">
                    <span class="stat-label-compact">Очки</span>
                    <span class="stat-value-compact">${awayStats?.points || '-'}</span>
                  </div>
                </div>
              </div>
              ` : ''}
            </div>
          `;
        }
      });
    });
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('❌ Error loading upcoming matches:', error);
    loading.style.display = 'none';
    container.innerHTML = `
      <div class="error-message">
        <h3>Помилка завантаження матчів</h3>
        <p>${error.message}</p>
        <button class="back-btn" onclick="loadUpcomingMatches()">Спробувати знову</button>
      </div>
    `;
  }
}

// Обробка кліку на логотип
function handleLogoClick() {
  toggleSidebar();
}

// Перемикання бічного меню
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  
  const isActive = sidebar.classList.toggle('active');
  
  if (isActive) {
    mainContent.classList.add('shifted');
  } else {
    mainContent.classList.remove('shifted');
  }
  
  console.log('🔄 Sidebar:', isActive ? 'відкрито' : 'закрито');
  console.log('📐 Main content shifted:', mainContent.classList.contains('shifted'));
}

// Повернутися на головну сторінку
function goHome() {
  currentLeague = null;
  
  // Показуємо головну
  document.getElementById('home-view').style.display = 'block';
  
  // Ховаємо контент турніру
  document.getElementById('league-content').style.display = 'none';
  
  //ховаємо результати пошуку
  const searchView = document.getElementById('search-results-view');
  if (searchView) {
    searchView.style.display = 'none';
  }

  // Деактивуємо всі пункти меню
  document.querySelectorAll('.submenu-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Очищаємо пошук
  document.getElementById('searchInput').value = '';
  hideSearchSuggestions();
  
  // Закриваємо sidebar
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  sidebar.classList.remove('active');
  mainContent.classList.remove('shifted');
}

// Перемикання підменю ліги
function toggleLeague(leagueId) {
  const submenu = document.getElementById(leagueId);
  const parentItem = submenu.previousElementSibling;
  
  document.querySelectorAll('.league-submenu').forEach(menu => {
    if (menu !== submenu) {
      menu.classList.remove('active');
      menu.previousElementSibling.classList.remove('active');
    }
  });
  
  submenu.classList.toggle('active');
  parentItem.classList.toggle('active');
}

// Вибір ліги
function selectLeague(leagueCode) {
  currentLeague = leagueCode;
  document.getElementById('currentLeagueName').textContent = leagueNames[leagueCode] || leagueCode;
  
  // Показати контент турніру, сховати головну
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('league-content').style.display = 'block';

  document.querySelectorAll('.submenu-item').forEach(item => {
    item.classList.remove('active');
  });
  event.target.classList.add('active');
  
  loadStandings();
  loadMatches();
  showView('standings');
  
  if (window.innerWidth <= 768) {
    toggleSidebar();
  }
}

// Перемикання вкладок
function showView(viewName) {
  document.querySelectorAll('.view-content').forEach(view => {
    view.style.display = 'none';
  });
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (viewName === 'standings') {
    document.getElementById('standings-view').style.display = 'block';
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
  } else if (viewName === 'matches') {
    document.getElementById('matches-view').style.display = 'block';
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
  } else if (viewName === 'analytics') {
    document.getElementById('analytics-view').style.display = 'block';
  } else if (viewName === 'search-results') {
    const searchView = document.getElementById('search-results-view');
    if (searchView) {
      searchView.style.display = 'block';
    }
  }
}

// Завантаження турнірної таблиці
async function loadStandings() {
  if (!currentLeague) return;
  
  const loadingDiv = document.getElementById("standings-loading");
  const tbody = document.querySelector('#standings-table tbody');
  
  try {
    if (loadingDiv) loadingDiv.style.display = "block";
    tbody.innerHTML = "";
    
    // <<< ЗМІНА: Використовуємо BASE_URL >>>
    const response = await fetch(`${BASE_URL}/standings/${currentLeague}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();

    if (loadingDiv) loadingDiv.style.display = "none";

    if (!data.standings || data.standings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10">Немає таблиці для цього турніру</td></tr>`;
      return;
    }

    const table = data.standings[0]?.table || [];
    
  table.forEach(team => {
  const row = document.createElement('tr');
  const crestUrl = team.team?.crest || '';
  const position = team.position;
  const totalTeams = table.length;
  
  // Визначаємо зону команди
  let zoneClass = '';
  
  // Ліга чемпіонів 
  if (['PL', 'PD', 'SA', 'BL1', ].includes(currentLeague)) {
    if (position <= 4) zoneClass = 'ucl-zone';
  } else if (['FL1'].includes(currentLeague)) {
    if (position <= 3) zoneClass = 'ucl-zone';
  } else if (['DED'].includes(currentLeague)) {
    if (position <= 2) zoneClass = 'ucl-zone';
  } else if (['DED', 'PPL',].includes(currentLeague)) {
    if (position === 1) zoneClass = 'ucl-zone';
  }
  
  // Зона вильоту 
  if (['PL', 'PD', 'SA',].includes(currentLeague)) {
    if (position >= totalTeams - 2) zoneClass = 'relegation-zone';
  } else if (['DED', 'BL1', 'PPL', 'FL1'].includes(currentLeague)) {
    if (position >= totalTeams - 1) zoneClass = 'relegation-zone';
  } else if (currentLeague === 'BSA') {
    if (position >= totalTeams - 3) zoneClass = 'relegation-zone';
  }
  
  row.className = zoneClass;
  
  row.innerHTML = `
    <td>${position}</td>
    <td class="team-cell">
      ${crestUrl ? `<img src="${crestUrl}" class="team-crest" onerror="this.style.display='none'">` : ''}
      <span>${team.team?.name ?? "-"}</span>
    </td>
    <td>${team.playedGames ?? "-"}</td>
    <td>${team.won ?? "-"}</td>
    <td>${team.draw ?? "-"}</td>
    <td>${team.lost ?? "-"}</td>
    <td>${team.goalsFor ?? "-"}</td>
    <td>${team.goalsAgainst ?? "-"}</td>
    <td><b>${(team.goalsFor - team.goalsAgainst) >= 0 ? '+' : ''}${team.goalsFor - team.goalsAgainst}</b></td>
    <td><b class="points">${team.points ?? "-"}</b></td>
  `;
  
  tbody.appendChild(row);
});
  } catch (err) {
    console.error("Error loadStandings:", err);
    if (loadingDiv) loadingDiv.style.display = "none";
    tbody.innerHTML = `<tr><td colspan="10">Помилка завантаження: ${err.message}</td></tr>`;
  }
}

// Завантаження матчів
async function loadMatches() {
  if (!currentLeague) return;
  
  const loadingDiv = document.getElementById("matches-loading");
  const tbody = document.querySelector('#matches-table tbody');
  
  try {
    if (loadingDiv) loadingDiv.style.display = "block";
    tbody.innerHTML = "";

    // <<< ЗМІНА: Використовуємо BASE_URL >>>
    const response = await fetch(`${BASE_URL}/matches/${currentLeague}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    allMatches = data.matches || [];
    
    if (loadingDiv) loadingDiv.style.display = "none";

    allMatches.forEach(match => {
      const row = document.createElement('tr');
      row.setAttribute("data-id", match.id);
      
      const homeScore = match.score?.fullTime?.home ?? "-";
      const awayScore = match.score?.fullTime?.away ?? "-";
      const status = getStatusText(match.status);
      
      row.innerHTML = `
        <td>${new Date(match.utcDate).toLocaleString('uk-UA')}</td>
        <td>${match.homeTeam?.name ?? "-"}</td>
        <td>${match.awayTeam?.name ?? "-"}</td>
        <td>${homeScore} : ${awayScore}</td>
        <td><span class="status status-${match.status.toLowerCase()}">${status}</span></td>
      `;
      row.addEventListener("click", () => loadMatchDetails(match.id));
      tbody.appendChild(row);
    });

    drawChart(data);
  } catch (err) {
    console.error("Error loadMatches:", err);
    if (loadingDiv) loadingDiv.style.display = "none";
    tbody.innerHTML = `<tr><td colspan="5">Помилка завантаження: ${err.message}</td></tr>`;
  }
}

function getStatusText(status) {
  const statusMap = {
    'FINISHED': 'Завершено',
    'TIMED': 'Заплановано',
    'SCHEDULED': 'Заплановано',
    'IN_PLAY': 'Грається',
    'PAUSED': 'Пауза',
    'POSTPONED': 'Перенесено',
    'CANCELLED': 'Скасовано',
    'SUSPENDED': 'Призупинено'
  };
  return statusMap[status] || status;
}

function drawChart(data) {
  const matches = data.matches || [];
  const teams = {};
  
  matches.forEach(match => {
    if (match.homeTeam?.name) teams[match.homeTeam.name] = (teams[match.homeTeam.name] || 0) + 1;
    if (match.awayTeam?.name) teams[match.awayTeam.name] = (teams[match.awayTeam.name] || 0) + 1;
  });

  const ctx = document.getElementById('matchesChart').getContext('2d');
  if (window.myChart) window.myChart.destroy();

  window.myChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(teams).slice(0, 10),
      datasets: [{
        label: 'Кількість матчів',
        data: Object.values(teams).slice(0, 10),
        backgroundColor: 'rgba(26, 13, 143, 0.6)',
        borderColor: 'rgba(26, 13, 143, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Кількість матчів по командах'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Замініть функцію loadMatchDetails на цю версію:

async function loadMatchDetails(matchId) {
  try {
    // <<< ЗМІНА: Використовуємо BASE_URL >>>
    // Отримуємо базову інформацію про матч
    const basicResponse = await fetch(`${BASE_URL}/match/${matchId}`);
    const basicData = await basicResponse.json();
    const basicMatch = basicData.match;
    
    if (!basicMatch) {
      throw new Error("Базова інформація про матч недоступна");
    }

    const homeTeam = basicMatch.homeTeam?.name || '';
    const awayTeam = basicMatch.awayTeam?.name || '';
    const matchDate = basicMatch.utcDate;

    let detailedData = null;
    
    // Намагаємося отримати детальну статистику
    try {
       // <<< ЗМІНА: Використовуємо BASE_URL >>>
      const detailedResponse = await fetch(
        `${BASE_URL}/match-detailed/${currentLeague}/${encodeURIComponent(homeTeam)}/${encodeURIComponent(awayTeam)}/${encodeURIComponent(matchDate)}`
      );
      
      if (detailedResponse.ok) {
        detailedData = await detailedResponse.json();
        
        // Якщо є примітка про mock-дані, показуємо користувачу
        if (detailedData.note) {
          console.log("ℹ️", detailedData.note);
        }
      }
    } catch (detailedError) {
      console.log("⚠️ Детальні дані недоступні:", detailedError.message);
    }

    // Відображаємо інформацію про матч
    displayDetailedMatch(basicMatch, detailedData);
    showView("analytics");
    
  } catch (err) {
    console.error("❌ Error loadMatchDetails:", err);
    document.getElementById("analytics").innerHTML = 
      `<p>Помилка завантаження аналітики: ${err.message}</p>`;
  }
}

function displayDetailedMatch(basicMatch, detailedData) {
  const analyticsDiv = document.getElementById("analytics");
  
  let matchHtml = `
    <div class="match-details">
      <div class="match-header">
        <h3>${basicMatch.homeTeam?.name || 'Домашні'} vs ${basicMatch.awayTeam?.name || 'Гості'}</h3>
        <div class="match-score">
          ${basicMatch.score?.fullTime?.home ?? 0} : ${basicMatch.score?.fullTime?.away ?? 0}
        </div>
      </div>
      
      <div class="match-info">
        <p><strong>Статус:</strong> ${getStatusText(basicMatch.status)}</p>
        <p><strong>Дата:</strong> ${new Date(basicMatch.utcDate).toLocaleString('uk-UA')}</p>
        <p><strong>Турнір:</strong> ${basicMatch.competition?.name || 'Невідомий'}</p>
        ${basicMatch.venue ? `<p><strong>Стадіон:</strong> ${basicMatch.venue}</p>` : ''}
        <p><strong>Тайм:</strong> ${basicMatch.score?.halfTime?.home ?? 0} : ${basicMatch.score?.halfTime?.away ?? 0}</p>
      </div>
  `;

  if (detailedData && detailedData.statistics && detailedData.statistics.length > 0) {
    matchHtml += generateDetailedStatistics(detailedData);
  }

  if (basicMatch.goals && basicMatch.goals.length > 0) {
    matchHtml += generateGoalsSection(basicMatch.goals);
  }

  if (basicMatch.bookings && basicMatch.bookings.length > 0) {
    matchHtml += generateBookingsSection(basicMatch.bookings);
  }

  if (!basicMatch.goals?.length && !basicMatch.bookings?.length && !detailedData) {
    matchHtml += '<p><em>Детальна інформація про матч недоступна</em></p>';
  }

  matchHtml += '</div>';
  analyticsDiv.innerHTML = matchHtml;
}

function generateDetailedStatistics(detailedData) {
  const stats = detailedData.statistics;
  if (!stats || stats.length < 2) return '';

  const homeStats = stats[0]?.statistics || [];
  const awayStats = stats[1]?.statistics || [];
  
  const homeStatsMap = {};
  const awayStatsMap = {};
  
  homeStats.forEach(stat => homeStatsMap[stat.type] = stat.value);
  awayStats.forEach(stat => awayStatsMap[stat.type] = stat.value);

  return `
    <div class="match-events">
      <h4>📊 Детальна статистика матчу:</h4>
      <div class="match-statistics">
        <div class="stats-header">
          <span class="team-name">${stats[0]?.team?.name || 'Домашні'}</span>
          <span class="stat-name">Показник</span>
          <span class="team-name">${stats[1]?.team?.name || 'Гості'}</span>
        </div>
        ${generateStatRow('Удари по воротах', homeStatsMap['Shots on Goal'], awayStatsMap['Shots on Goal'])}
        ${generateStatRow('Загальні удари', homeStatsMap['Total Shots'], awayStatsMap['Total Shots'])}
        ${generateStatRow('Володіння м\'ячем (%)', homeStatsMap['Ball Possession'], awayStatsMap['Ball Possession'])}
        ${generateStatRow('Передачі (%)', homeStatsMap['Passes %'], awayStatsMap['Passes %'])}
        ${generateStatRow('Фоли', homeStatsMap['Fouls'], awayStatsMap['Fouls'])}
        ${generateStatRow('Кутові', homeStatsMap['Corner Kicks'], awayStatsMap['Corner Kicks'])}
        ${generateStatRow('Офсайди', homeStatsMap['Offsides'], awayStatsMap['Offsides'])}
      </div>
    </div>
  `;
}

function generateGoalsSection(goals) {
  return `
    <div class="match-events">
      <h4>⚽ Голи:</h4>
      <ul class="goals-list">
        ${goals.map(goal => `
          <li>
            <span class="minute">${goal.minute || '?'}'</span>
            <span class="player">${goal.scorer?.name || 'Невідомий'}</span>
            <span class="team">(${goal.team?.name || 'Невідома команда'})</span>
            ${goal.assist?.name ? `<span class="assist">Асист: ${goal.assist.name}</span>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function generateBookingsSection(bookings) {
  return `
    <div class="match-events">
      <h4>🟨🟥 Картки:</h4>
      <ul class="cards-list">
        ${bookings.map(card => `
          <li>
            <span class="minute">${card.minute || '?'}'</span>
            <span class="card">${card.card === 'YELLOW_CARD' ? '🟨' : '🟥'}</span>
            <span class="player">${card.player?.name || 'Невідомий'}</span>
            <span class="team">(${card.team?.name || 'Невідома команда'})</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function generateStatRow(label, homeStat, awayStat) {
  const homeValue = parseFloat(homeStat) || 0;
  const awayValue = parseFloat(awayStat) || 0;
  
  if (label.includes('%')) {
    return `
      <div class="stat-row">
        <div class="stat-value home">${homeValue}%</div>
        <div class="stat-bar">
          <div class="stat-label">${label}</div>
          <div class="bar-container">
            <div class="bar-fill home" style="width: ${homeValue}%"></div>
            <div class="bar-fill away" style="width: ${100 - homeValue}%"></div>
          </div>
        </div>
        <div class="stat-value away">${awayValue}%</div>
      </div>
    `;
  }
  
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;
  const awayPercent = total > 0 ? (awayValue / total) * 100 : 50;
  
  return `
    <div class="stat-row">
      <div class="stat-value home">${homeValue}</div>
      <div class="stat-bar">
        <div class="stat-label">${label}</div>
        <div class="bar-container">
          <div class="bar-fill home" style="width: ${homePercent}%"></div>
          <div class="bar-fill away" style="width: ${awayPercent}%"></div>
        </div>
      </div>
      <div class="stat-value away">${awayValue}</div>
    </div>
  `;
}

// === ПОШУК КЛУБІВ ===

let searchTimeout;
const searchInput = document.getElementById('searchInput');

const popularClubs = [
  'Manchester United FC', 'Manchester City FC', 'Liverpool FC', 'Chelsea FC', 'Arsenal FC',
  'Tottenham Hotspur FC', 'Newcastle United FC', 'Aston Villa FC', 'Brighton & Hove Albion FC',
  'West Ham United FC', 
  
  'FC Barcelona', 'Real Madrid CF', 'Atlético de Madrid', 'Real Betis Balompié',
  'Sevilla FC', 'Valencia CF', 'Real Sociedad de Fútbol', 'Villarreal CF', 
  
  'Juventus FC', 'FC Internazionale Milano', 'AC Milan', 'SSC Napoli', 'AS Roma', 'SS Lazio', 'Atalanta BC',
  'ACF Fiorentina', 
  
  'FC Bayern München', 'Borussia Dortmund', 'RB Leipzig', 'Bayer 04 Leverkusen',
  'Eintracht Frankfurt', 'VfB Stuttgart', 
  
  'Paris Saint-Germain FC', 'Olympique de Marseille', 'Olympique Lyonnais', 'AS Monaco FC', 'OGC Nice', 
  
  'AFC Ajax', 'PSV', 'Feyenoord Rotterdam', 'AZ', 'Sparta Rotterdam',
  
  'CR Flamengo', 'Fluminense FC', 'Botafogo FR', 'Santos FC', 'SE Palmeiras',
  
  'FC Porto', 'Sport Lisboa e Benfica', 'Sporting Clube de Portugal', 
];

searchInput?.addEventListener('input', (e) => {
  const searchTerm = e.target.value.trim();
  
  clearTimeout(searchTimeout);
  
  if (searchTerm.length >= 2) {
    showSearchSuggestions(searchTerm);
  } else {
    hideSearchSuggestions();
  }
  
  if (searchTerm.length < 3) {
    return;
  }
  
  searchTimeout = setTimeout(() => {
    searchClub(searchTerm);
  }, 800);
});

function showSearchSuggestions(searchTerm) {
  const searchLower = searchTerm.toLowerCase();
  
  const suggestions = popularClubs.filter(club => {
    const clubLower = club.toLowerCase();
    const clubWords = clubLower.split(/\s+/);
    
    return clubWords.some(word => word.startsWith(searchLower)) || 
           clubLower.includes(searchLower);
  }).slice(0, 8);
  
  if (suggestions.length === 0) return;
  
  let suggestionBox = document.getElementById('search-suggestions');
  if (!suggestionBox) {
    suggestionBox = document.createElement('div');
    suggestionBox.id = 'search-suggestions';
    suggestionBox.className = 'search-suggestions';
    searchInput.parentElement.appendChild(suggestionBox);
  }
  
  suggestionBox.innerHTML = suggestions.map(club => {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const highlighted = club.replace(regex, '<strong>$1</strong>');
    return `<div class="suggestion-item" onclick="selectSuggestion('${club.replace(/'/g, "\\'")}')">${highlighted}</div>`;
  }).join('');
  suggestionBox.style.display = 'block';
}

function hideSearchSuggestions() {
  const suggestionBox = document.getElementById('search-suggestions');
  if (suggestionBox) {
    suggestionBox.style.display = 'none';
  }
}

function selectSuggestion(clubName) {
  searchInput.value = clubName;
  hideSearchSuggestions();
  searchClub(clubName);
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    hideSearchSuggestions();
  }
});

async function searchClub(teamName) {
  try {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('league-content').style.display = 'none';
    
    showView('search-results');
    
    const searchView = document.getElementById('search-results-view');
    if (!searchView) {
      const mainContent = document.getElementById('mainContent');
      const newView = document.createElement('div');
      newView.id = 'search-results-view';
      newView.className = 'view-content';
      newView.style.display = 'none';
      mainContent.appendChild(newView);
    }
    
    document.getElementById('search-results-view').innerHTML = '<div class="loading">Шукаю клуб...</div>';
    showView('search-results');
    
    // <<< ЗМІНА: Використовуємо BASE_URL >>>
    const response = await fetch(`${BASE_URL}/search-club/${encodeURIComponent(teamName)}`);
    const data = await response.json();
    
    if (data.error) {
      document.getElementById('search-results-view').innerHTML = `
        <div class="search-error">
          <h3>❌ ${data.error}</h3>
          <p>${data.message}</p>
        </div>
      `;
      return;
    }
    
    displayClubSearchResults(data);
    
  } catch (error) {
    console.error('Search error:', error);
    document.getElementById('search-results-view').innerHTML = `
      <div class="search-error">
        <h3>Помилка пошуку</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function displayClubSearchResults(data) {
  const searchView = document.getElementById('search-results-view');
  
  const matchesByCompetition = {};
  data.matches.forEach(match => {
    const compKey = match.competition || match.competitionName;
    if (!matchesByCompetition[compKey]) {
      matchesByCompetition[compKey] = {
        name: match.competitionName,
        matches: []
      };
    }
    matchesByCompetition[compKey].matches.push(match);
  });
  
  const competitions = Object.keys(matchesByCompetition);
  
  let html = `
    <div class="club-search-results">
      <h2>🔍 Результати пошуку: ${data.standings[0]?.team?.name || data.teamName}</h2>
      
      ${data.standings[0]?.team?.crest ? `
        <div class="club-header">
          <img src="${data.standings[0].team.crest}" class="club-logo" alt="Емблема клубу">
        </div>
      ` : ''}
      
      <h3>📊 Статистика у турнірах (Сезон 2024/25)</h3>
      <div class="club-standings">
        ${data.standings.map(standing => `
          <div class="standing-card">
            <h4>${standing.competitionName}</h4>
            <div class="standing-stats">
              <div class="stat-item">
                <span class="stat-label">Позиція</span>
                <span class="stat-value big">${standing.position}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Очки</span>
                <span class="stat-value big">${standing.points}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Матчі</span>
                <span class="stat-value">${standing.playedGames}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Перемоги</span>
                <span class="stat-value">${standing.won}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Нічиї</span>
                <span class="stat-value">${standing.draw}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Поразки</span>
                <span class="stat-value">${standing.lost}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Забито</span>
                <span class="stat-value">${standing.goalsFor}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Пропущено</span>
                <span class="stat-value">${standing.goalsAgainst}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Різниця</span>
                <span class="stat-value ${standing.goalDifference >= 0 ? 'positive' : 'negative'}">
                  ${standing.goalDifference >= 0 ? '+' : ''}${standing.goalDifference}
                </span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <h3>📅 Матчі клубу (${data.matches.length})</h3>
      
      <div class="competition-tabs">
        ${competitions.map((comp, index) => `
          <button class="competition-tab ${index === 0 ? 'active' : ''}" 
                  onclick="showCompetitionMatches('${comp}')">
            ${matchesByCompetition[comp].name} (${matchesByCompetition[comp].matches.length})
          </button>
        `).join('')}
      </div>
      
      ${competitions.map((comp, index) => `
        <div class="competition-matches" id="matches-${comp}" style="display: ${index === 0 ? 'block' : 'none'}">
          <div class="club-matches">
            <table class="matches-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Домашні</th>
                  <th>Рахунок</th>
                  <th>Гості</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                ${matchesByCompetition[comp].matches.map(match => `
                  <tr onclick="loadMatchDetails(${match.id})" style="cursor: pointer;">
                    <td>${new Date(match.utcDate).toLocaleDateString('uk-UA', {day: '2-digit', month: '2-digit'})}</td>
                    <td class="team-name">${match.homeTeam?.name || '-'}</td>
                    <td class="match-score">
                      ${match.score?.fullTime?.home ?? '-'} : ${match.score?.fullTime?.away ?? '-'}
                    </td>
                    <td class="team-name">${match.awayTeam?.name || '-'}</td>
                    <td><span class="status status-${match.status.toLowerCase()}">${getStatusText(match.status)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  searchView.innerHTML = html;
}

function showCompetitionMatches(competitionKey) {
  document.querySelectorAll('.competition-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll('.competition-matches').forEach(matches => {
    matches.style.display = 'none';
  });
  
  event.target.classList.add('active');
  document.getElementById(`matches-${competitionKey}`).style.display = 'block';
}

function showView(viewName) {
  console.log('👁️ Показую вкладку:', viewName);
  
  // Ховаємо всі вкладки контенту
  document.querySelectorAll('.view-content').forEach(view => {
    view.style.display = 'none';
  });
  
  // Деактивуємо всі кнопки табів
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (viewName === 'standings') {
    const standingsView = document.getElementById('standings-view');
    standingsView.style.display = 'block';
    document.querySelectorAll('.tab-btn')[0]?.classList.add('active');
    console.log('✅ Таблиця показана, display:', standingsView.style.display);
  } else if (viewName === 'matches') {
    document.getElementById('matches-view').style.display = 'block';
    document.querySelectorAll('.tab-btn')[1]?.classList.add('active');
  } else if (viewName === 'analytics') {
    document.getElementById('analytics-view').style.display = 'block';
  } else if (viewName === 'search-results') {
    const searchView = document.getElementById('search-results-view');
    if (searchView) {
      searchView.style.display = 'block';
    }
  }
}


