import { globalAssets } from './state.js';

let LEAGUES_DATA = []; 
let selectedLeagueName = '';

export const getSelectedLeague = () => selectedLeagueName;

export function initLeagueManager(onRenderCallback) {
    const leagueInput = document.getElementById('league-search-input');
    const leagueResults = document.getElementById('league-search-results');

    // Load data
    fetch('assets/data/leagues_clubs.json')
        .then(response => {
            if (!response.ok) throw new Error("Chưa có file JSON");
            return response.json();
        })
        .then(data => { LEAGUES_DATA = data; })
        .catch(() => console.warn("Chưa tải được danh sách giải đấu."));

    // Logic Search
    leagueInput?.addEventListener('input', (e) => {
        const keyword = e.target.value.toUpperCase();
        leagueResults.innerHTML = ''; 

        if (keyword.length === 0) {
            leagueResults.style.display = 'none';
            return;
        }

        const filtered = LEAGUES_DATA.filter(league => league.includes(keyword));
        
        if (filtered.length > 0) {
            leagueResults.style.display = 'block';
            filtered.forEach(league => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.alignItems = 'center';
                li.style.gap = '10px';

                const img = document.createElement('img');
                img.src = `assets/img/watermarkFrame/leagueLogo/${league}.png`;
                img.style.width = '24px';
                img.style.height = '24px';
                img.style.objectFit = 'contain';

                const span = document.createElement('span');
                span.textContent = league;

                li.appendChild(img);
                li.appendChild(span);
                
                li.addEventListener('click', () => selectLeague(league));
                leagueResults.appendChild(li);
            });
        } else {
            leagueResults.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== leagueInput && e.target !== leagueResults) {
            leagueResults.style.display = 'none';
        }
    });

    function selectLeague(leagueName) {
        leagueInput.value = leagueName;
        selectedLeagueName = leagueName;
        leagueResults.style.display = 'none';

        const img = new Image();
        img.onload = () => { globalAssets.dynamicLeagueLogo = img; onRenderCallback(); };
        img.onerror = () => { globalAssets.dynamicLeagueLogo = null; onRenderCallback(); };
        img.src = `assets/img/watermarkFrame/leagueLogo/${leagueName}.png`; 
    }

    // Gọi lần đầu
    selectLeague('PREMIER LEAGUE');
}