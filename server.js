const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();


const app = express();
const PORT = 8080;

app.use(cors());

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

const LEAGUE_MAPPING = {
  'PL': '39',
  'PD': '140',
  'SA': '135',
  'BL1': '78',
  'FL1': '61',
  'CL': '2',
  'WC': '1',
  'EC': '4',
  'ELC': '40',
  'DED': '88',
  'PPL': '94',
  'BSA': '71'
};

const ALL_COMPETITIONS = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'ELC', 'DED', 'PPL', 'BSA'];

// НОВИЙ ENDPOINT - Головна сторінка з найближчими матчами
app.get("/upcoming-matches", async (req, res) => {
  console.log(`🏠 Завантаження головної сторінки з найближчими матчами`);
  
  try {
    const upcomingMatches = [];
    const today = new Date();
    
    for (const competition of ALL_COMPETITIONS) {
      try {
        console.log(`🔄 Завантажую матчі для ${competition}...`);
        
        // Отримуємо матчі турніру
        const matchesResponse = await axios.get(
          `https://api.football-data.org/v4/competitions/${competition}/matches`,
          { 
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
            timeout: 5000
          }
        );

        // Отримуємо турнірну таблицю для статистики команд
        let standingsData = null;
        try {
          const standingsResponse = await axios.get(
            `https://api.football-data.org/v4/competitions/${competition}/standings`,
            { 
              headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
              timeout: 5000
            }
          );
          standingsData = standingsResponse.data.standings?.[0]?.table || [];
          console.log(`📊 ${competition}: Таблиця завантажена (${standingsData.length} команд)`);
        } catch (err) {
          console.log(`⚠️ ${competition}: Таблиця недоступна - ${err.message}`);
          standingsData = [];
        }

        const matches = matchesResponse.data.matches || [];
        console.log(`📋 ${competition}: Всього матчів у відповіді: ${matches.length}`);
        
        // Фільтруємо матчі: грається зараз, завершилися сьогодні, або найближчі 30 днів
        const relevantMatches = matches
          .filter(match => {
            const matchDate = new Date(match.utcDate);
            const daysDiff = (matchDate - today) / (1000 * 60 * 60 * 24);
            
            // Матч грається зараз
            if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
              return true;
            }
            
           // Майбутні матчі (до 30 днів)
  if (match.status === 'TIMED' || match.status === 'SCHEDULED') {
    return daysDiff >= 0 && daysDiff <= 30;
  }
            
          
            
            return false;
          })
          .sort((a, b) => {
            // Спочатку live матчі, потім по даті
            const aLive = a.status === 'IN_PLAY' || a.status === 'PAUSED' ? 0 : 1;
            const bLive = b.status === 'IN_PLAY' || b.status === 'PAUSED' ? 0 : 1;
            if (aLive !== bLive) return aLive - bLive;
            return new Date(a.utcDate) - new Date(b.utcDate);
          })
          .slice(0, 2)
          .map(match => {
            // Додаємо статистику команд з таблиці (якщо доступна)
            let homeTeamStats = null;
            let awayTeamStats = null;
            
            if (standingsData && standingsData.length > 0) {
              homeTeamStats = standingsData.find(t => t.team?.id === match.homeTeam?.id);
              awayTeamStats = standingsData.find(t => t.team?.id === match.awayTeam?.id);
            }
            
            return {
              ...match,
              homeTeamStats: homeTeamStats ? {
                position: homeTeamStats.position,
                playedGames: homeTeamStats.playedGames,
                goalsFor: homeTeamStats.goalsFor,
                goalsAgainst: homeTeamStats.goalsAgainst,
                points: homeTeamStats.points
              } : null,
              awayTeamStats: awayTeamStats ? {
                position: awayTeamStats.position,
                playedGames: awayTeamStats.playedGames,
                goalsFor: awayTeamStats.goalsFor,
                goalsAgainst: awayTeamStats.goalsAgainst,
                points: awayTeamStats.points
              } : null
            };
          });

        console.log(`🔍 ${competition}: Знайдено ${relevantMatches.length} релевантних матчів`);

        if (relevantMatches.length > 0) {
          upcomingMatches.push({
            competition: competition,
            competitionName: matchesResponse.data.competition?.name || competition,
            matches: relevantMatches
          });
          console.log(`✅ ${competition}: Додано ${relevantMatches.length} матчів`);
        } else {
          console.log(`⏭️ ${competition}: Немає матчів для відображення`);
        }

        // Затримка між запитами (ліміт API)
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        if (error.response?.status === 429) {
          console.log(`⚠️ ${competition}: Ліміт API досягнуто (429)`);
        } else if (error.code === 'ECONNABORTED') {
          console.log(`⚠️ ${competition}: Таймаут запиту`);
        } else {
          console.log(`❌ ${competition}: ${error.message}`);
        }
      }
    }

    console.log(`\n🎯 ПІДСУМОК: Завантажено матчі з ${upcomingMatches.length} турнірів`);
    upcomingMatches.forEach(comp => {
      console.log(`   - ${comp.competitionName}: ${comp.matches.length} матчів`);
    });

    res.json({ competitions: upcomingMatches });

  } catch (error) {
    console.error("❌ Критична помилка:", error.message);
    res.status(500).json({ error: "Помилка завантаження матчів" });
  }
});

// НОВИЙ ENDPOINT - Пошук клубу по всіх чемпіонатах
app.get("/search-club/:teamName", async (req, res) => {
  const teamName = req.params.teamName;
  console.log(`🔍 Пошук клубу: ${teamName}`);
  
  try {
    const results = {
      teamName: teamName,
      standings: [],
      matches: []
    };

    // Шукаємо клуб у всіх чемпіонатах
    for (const competition of ALL_COMPETITIONS) {
      try {
        // Отримуємо турнірну таблицю
        const standingsResponse = await axios.get(
          `https://api.football-data.org/v4/competitions/${competition}/standings`,
          { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
        );

        const table = standingsResponse.data.standings?.[0]?.table || [];
        
        // Точний пошук - шукаємо повну назву або початок слова
        const teamInTable = table.find(team => {
          const fullName = team.team?.name?.toLowerCase() || '';
          const searchLower = teamName.toLowerCase();
          
          // Перевіряємо точну відповідність або початок слова
          return fullName === searchLower || 
                 fullName.split(' ').some(word => word.startsWith(searchLower));
        });

        if (teamInTable) {
          results.standings.push({
            competition: competition,
            competitionName: standingsResponse.data.competition?.name || competition,
            position: teamInTable.position,
            team: teamInTable.team,
            playedGames: teamInTable.playedGames,
            won: teamInTable.won,
            draw: teamInTable.draw,
            lost: teamInTable.lost,
            points: teamInTable.points,
            goalsFor: teamInTable.goalsFor,
            goalsAgainst: teamInTable.goalsAgainst,
            goalDifference: teamInTable.goalsFor - teamInTable.goalsAgainst
          });

          // Отримуємо матчі цієї команди
          const matchesResponse = await axios.get(
            `https://api.football-data.org/v4/competitions/${competition}/matches`,
            { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
          );

          const teamMatches = matchesResponse.data.matches?.filter(match => {
            const homeNameLower = match.homeTeam?.name?.toLowerCase() || '';
            const awayNameLower = match.awayTeam?.name?.toLowerCase() || '';
            const searchLower = teamName.toLowerCase();
            
            return homeNameLower === searchLower || 
                   awayNameLower === searchLower ||
                   homeNameLower.split(' ').some(word => word.startsWith(searchLower)) ||
                   awayNameLower.split(' ').some(word => word.startsWith(searchLower));
          }) || [];

          teamMatches.forEach(match => {
            results.matches.push({
              ...match,
              competition: competition,
              competitionName: standingsResponse.data.competition?.name || competition
            });
          });
        }

        // Затримка між запитами (ліміт API)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`⚠️ Помилка пошуку в ${competition}:`, error.message);
      }
    }

    console.log(`✅ Знайдено клуб у ${results.standings.length} турнірах`);
    console.log(`✅ Знайдено ${results.matches.length} матчів`);

    if (results.standings.length === 0) {
      return res.json({ 
        error: "Команду не знайдено",
        message: `Клуб "${teamName}" не знайдено в жодному з доступних турнірів`
      });
    }

    res.json(results);

  } catch (error) {
    console.error("❌ Search club error:", error.message);
    res.status(500).json({ error: "Помилка пошуку клубу" });
  }
});

// Отримати всі матчі турніру
app.get("/matches/:competition", async (req, res) => {
  const competition = req.params.competition;
  try {
    console.log(`📅 Запит матчів для: ${competition}`);
    const response = await axios.get(
      `https://api.football-data.org/v4/competitions/${competition}/matches`,
      { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
    );
    console.log(`✅ Отримано ${response.data.matches?.length || 0} матчів`);
    res.json(response.data);
  } catch (error) {
    console.error("❌ Matches error:", error.response?.data || error.message);
    res.status(500).json({ error: "Помилка отримання матчів" });
  }
});

// Отримати турнірну таблицю
app.get("/standings/:competition", async (req, res) => {
  const competition = req.params.competition;
  console.log(`📋 Запит турнірної таблиці для: ${competition}`);

  try {
    console.log(`🏈 Отримую таблицю для ліги: ${competition}`);
    const response = await axios.get(
      `https://api.football-data.org/v4/competitions/${competition}/standings`,
      { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
    );
    console.log(`✅ Таблиця отримана для ${competition}`);
    res.json(response.data);
  } catch (error) {
    console.error("❌ Standings error:", error.response?.data || error.message);
    res.status(500).json({ error: "Помилка отримання таблиці" });
  }
});

// Базова інформація про матч
app.get("/match/:id", async (req, res) => {
  const matchId = req.params.id;
  try {
    console.log(`🔍 Отримую базові дані матчу ID: ${matchId}`);
    const response = await axios.get(
      `https://api.football-data.org/v4/matches/${matchId}`,
      { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
    );
    
    const match = response.data.match;
    console.log(`📋 Базова інформація:`, {
      goals: match.goals?.length || 0,
      bookings: match.bookings?.length || 0,
      substitutions: match.substitutions?.length || 0,
    });
    
    res.json(response.data);
  } catch (error) {
    console.error("❌ Match details error:", error.response?.data || error.message);
    
    const mockMatch = {
      match: {
        id: matchId,
        homeTeam: { name: "Домашня команда" },
        awayTeam: { name: "Гостьова команда" },
        score: { fullTime: { home: 0, away: 0 }, halfTime: { home: 0, away: 0 } },
        status: "FINISHED",
        utcDate: new Date().toISOString(),
        competition: { name: "Невідомий турнір" },
        goals: [],
        bookings: [],
        substitutions: []
      }
    };
    
    console.log(`📝 Повертаю заглушку для матчу ${matchId}`);
    res.json(mockMatch);
  }
});

// Детальна аналітика з API-Football
app.get("/match-detailed/:competition/:homeTeam/:awayTeam/:date", async (req, res) => {
  const { competition, homeTeam, awayTeam, date } = req.params;
  
  try {
    const rapidApiLeagueId = LEAGUE_MAPPING[competition];
    if (!rapidApiLeagueId) {
      return res.json({ error: "Ліга не підтримується в API-Football" });
    }

    const matchDate = new Date(date).toISOString().split('T')[0];

    const fixturesResponse = await axios.get(
      'https://api-football-v1.p.rapidapi.com/v3/fixtures',
      {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        },
        params: {
          league: rapidApiLeagueId,
          season: '2024',
          date: matchDate
        }
      }
    );

    const fixtures = fixturesResponse.data.response || [];
    
    const fixture = fixtures.find(match => {
      const homeMatch = match.teams.home.name.toLowerCase().includes(homeTeam.split(' ')[0].toLowerCase()) || 
                       homeTeam.toLowerCase().includes(match.teams.home.name.split(' ')[0].toLowerCase());
      const awayMatch = match.teams.away.name.toLowerCase().includes(awayTeam.split(' ')[0].toLowerCase()) || 
                       awayTeam.toLowerCase().includes(match.teams.away.name.split(' ')[0].toLowerCase());
      
      return homeMatch && awayMatch;
    });

    if (!fixture) {
      const mockData = {
        statistics: [
          {
            team: { name: homeTeam },
            statistics: [
              { type: "Shots on Goal", value: "8" },
              { type: "Total Shots", value: "15" },
              { type: "Ball Possession", value: "65" },
              { type: "Fouls", value: "12" },
              { type: "Corner Kicks", value: "6" }
            ]
          },
          {
            team: { name: awayTeam },
            statistics: [
              { type: "Shots on Goal", value: "5" },
              { type: "Total Shots", value: "12" },
              { type: "Ball Possession", value: "35" },
              { type: "Fouls", value: "8" },
              { type: "Corner Kicks", value: "3" }
            ]
          }
        ],
        lineups: [],
        events: []
      };
      
      return res.json(mockData);
    }

    const [statisticsResponse, lineupsResponse, eventsResponse] = await Promise.all([
      axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics', {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        },
        params: { fixture: fixture.fixture.id }
      }).catch(err => ({ data: { response: [] } })),
      
      axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures/lineups', {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        },
        params: { fixture: fixture.fixture.id }
      }).catch(err => ({ data: { response: [] } })),

      axios.get('https://api-football-v1.p.rapidapi.com/v3/fixtures/events', {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        },
        params: { fixture: fixture.fixture.id }
      }).catch(err => ({ data: { response: [] } }))
    ]);

    const detailedData = {
      fixture: fixture,
      statistics: statisticsResponse.data.response || [],
      lineups: lineupsResponse.data.response || [],
      events: eventsResponse.data.response || []
    };

    res.json(detailedData);
  } catch (error) {
    console.error("❌ Detailed stats error:", error.message);
    res.status(500).json({ error: "Помилка отримання детальної статистики" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер працює на http://localhost:${PORT}`);
  console.log(`🔑 Football-data.org API: ${FOOTBALL_DATA_API_KEY ? 'Підключено' : 'Відсутній'}`);
  console.log(`🚀 RapidAPI ключ: ${RAPIDAPI_KEY ? 'Підключено' : 'Відсутній'}`);
  console.log(`🏆 Підтримувані ліги: ${Object.keys(LEAGUE_MAPPING).join(', ')}`);
  console.log(`🔍 Пошук клубів доступний через /search-club/:teamName`);
});