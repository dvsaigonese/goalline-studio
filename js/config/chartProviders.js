export const DATA_PROVIDERS = {
    'understat': {
        name: "Understat",
        metrics: {
            'goals': { group: 'shooting', label: 'Goals', p90Max: 1.0, absMax: 25 },
            'xG': { group: 'shooting', label: 'xG', p90Max: 0.8, absMax: 20 },
            'shots': { group: 'shooting', label: 'Shots', p90Max: 4.5, absMax: 100 },
            'assists': { group: 'passing', label: 'Assists', p90Max: 0.6, absMax: 15 },
            'xA': { group: 'passing', label: 'xA', p90Max: 0.5, absMax: 12 },
            'key_passes': { group: 'passing', label: 'Key Passes', p90Max: 3.5, absMax: 90 },
            'xGChain': { group: 'possession', label: 'xG Chain', p90Max: 1.5, absMax: 30 },
            'xGBuildup': { group: 'possession', label: 'xG Buildup', p90Max: 1.0, absMax: 20 }
        },
        defaultKeys: ['xG', 'xA', 'key_passes', 'shots', 'xGBuildup']
    },
    'fotmob': {
        name: "FotMob API",
        metrics: {
            'accurate_passes': { group: 'passing', label: 'Acc. Passes', p90Max: 60, absMax: 2000 },
            'duel_won': { group: 'defending', label: 'Duels Won', p90Max: 8, absMax: 300 }
        },
        defaultKeys: ['accurate_passes', 'duel_won']
    }
};

export const GROUP_COLORS = { 
    'shooting': '#ef4444', 
    'passing': '#3b82f6', 
    'possession': '#f59e0b', 
    'defending': '#10b981' 
};