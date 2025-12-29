class BubbaOptimizer {
    constructor() {
        this.upgrades = {};
        this.levels = {};
        this.availableMoney = 1000;
        this.focus = 'efficiency';
        this.recommendation = null;
        
        this.init();
    }

    async init() {
        // Try to load from Google Sheets first, then local backup
        try {
            await this.loadFromGoogleSheets();
        } catch (error) {
            console.warn('Failed to load from Google Sheets, using local data');
            await this.loadLocalData();
        }
        
        this.loadFromStorage();
        this.renderUpgrades();
        this.setupEventListeners();
        this.hideLoading();
    }

    async loadFromGoogleSheets() {
        // Your published Google Sheet CSV URL
        const sheetId = '1iEBqFKfsIsVkM_-6hO9j7uIdtrRHuT4UN93xmmeI9Eo';
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=DataExport`;
        
        const response = await fetch(sheetUrl);
        const csvData = await response.text();
        
        // Parse CSV and convert to JSON
        // This assumes you've set up the DataExport sheet as described
        // For now, we'll use local data as backup
        console.log('CSV data loaded:', csvData);
    }

    async loadLocalData() {
        try {
            const response = await fetch('data/upgrades.json');
            const data = await response.json();
            this.upgrades = data.upgrades;
        } catch (error) {
            // Fallback data
            this.upgrades = {
                "Bubbles": {
                    "baseCost": 50,
                    "benefit": 0.02,
                    "maxLevel": 175,
                    "description": "Increases chance to catch rare fish"
                },
                "Bubble Breakthrough": {
                    "baseCost": 100,
                    "benefit": 0.10,
                    "maxLevel": 90,
                    "description": "Increases damage per bubble pop"
                },
                "Bubble Boost": {
                    "baseCost": 250,
                    "benefit": 0.02,
                    "maxLevel": 120,
                    "description": "Increases bubble spawn rate"
                },
                "More Bubbles": {
                    "baseCost": 2000,
                    "benefit": 1,
                    "maxLevel": 45,
                    "description": "Increases maximum bubbles"
                },
                "Bubble Bonanza": {
                    "baseCost": 5000,
                    "benefit": 0.05,
                    "maxLevel": 25,
                    "description": "Chance for double bubble spawn"
                },
                "Golden Bubbles": {
                    "baseCost": 10000,
                    "benefit": 0.15,
                    "maxLevel": 20,
                    "description": "Increases money from bubbles"
                }
            };
        }
    }

    loadFromStorage() {
        const savedLevels = localStorage.getItem('bubbaLevels');
        const savedMoney = localStorage.getItem('bubbaMoney');
        
        if (savedLevels) {
            this.levels = JSON.parse(savedLevels);
        } else {
            // Initialize all levels to 0
            Object.keys(this.upgrades).forEach(upgrade => {
                this.levels[upgrade] = 0;
            });
        }
        
        if (savedMoney) {
            this.availableMoney = parseInt(savedMoney);
            document.getElementById('moneyInput').value = this.availableMoney;
        }
    }

    saveToStorage() {
        localStorage.setItem('bubbaLevels', JSON.stringify(this.levels));
        localStorage.setItem('bubbaMoney', this.availableMoney.toString());
    }

    setupEventListeners() {
        // Calculate button
        document.getElementById('calculateBtn').addEventListener('click', () => {
            this.calculateBestUpgrade();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('Reset all levels to 0?')) {
                Object.keys(this.levels).forEach(upgrade => {
                    this.levels[upgrade] = 0;
                });
                this.renderUpgrades();
                this.saveToStorage();
            }
        });

        // Save button
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveProgress();
        });

        // Load JSON button
        document.getElementById('loadBtn').addEventListener('click', () => {
            document.getElementById('jsonInput').value = JSON.stringify({
                levels: this.levels,
                money: this.availableMoney
            }, null, 2);
        });

        // Import JSON button
        document.getElementById('importJsonBtn').addEventListener('click', () => {
            this.importFromJson();
        });

        // Money input
        document.getElementById('moneyInput').addEventListener('input', (e) => {
            this.availableMoney = parseInt(e.target.value) || 0;
            this.saveToStorage();
        });

        // Focus select
        document.getElementById('focusSelect').addEventListener('change', (e) => {
            this.focus = e.target.value;
        });
    }

    calculateBestUpgrade() {
        this.availableMoney = parseInt(document.getElementById('moneyInput').value) || 0;
        
        let bestUpgrade = null;
        let bestValue = 0;
        
        Object.entries(this.upgrades).forEach(([name, data]) => {
            const currentLevel = this.levels[name];
            
            if (currentLevel >= data.maxLevel) return;
            
            const nextCost = this.calculateCost(name, currentLevel + 1);
            
            if (nextCost > this.availableMoney) return;
            
            let value;
            switch(this.focus) {
                case 'efficiency':
                    value = data.benefit / nextCost;
                    break;
                case 'damage':
                    value = data.benefit;
                    break;
                case 'profit':
                    value = data.benefit * 100 / nextCost; // Example formula
                    break;
                case 'total':
                    value = data.benefit * (currentLevel + 1);
                    break;
                default:
                    value = data.benefit / nextCost;
            }
            
            if (value > bestValue) {
                bestValue = value;
                bestUpgrade = name;
            }
        });
        
        this.recommendation = bestUpgrade;
        this.showRecommendation(bestUpgrade);
        this.renderUpgrades();
    }

    calculateCost(upgradeName, level) {
        const baseCost = this.upgrades[upgradeName].baseCost;
        return Math.floor(baseCost * Math.pow(1.15, level - 1));
    }

    showRecommendation(upgradeName) {
        const recommendationBox = document.getElementById('recommendationBox');
        
        if (!upgradeName) {
            recommendationBox.innerHTML = `
                <div class="recommendation-placeholder">
                    <i class="fas fa-times-circle"></i>
                    <p>No affordable upgrades available</p>
                </div>
            `;
            return;
        }
        
        const upgrade = this.upgrades[upgradeName];
        const currentLevel = this.levels[upgradeName];
        const nextCost = this.calculateCost(upgradeName, currentLevel + 1);
        const totalCost = this.calculateTotalSpent(upgradeName);
        
        recommendationBox.innerHTML = `
            <div class="recommendation-details">
                <h3><i class="fas fa-crown"></i> ${upgradeName}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Next Level:</span>
                        <span class="info-value">${currentLevel + 1} / ${upgrade.maxLevel}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Cost:</span>
                        <span class="info-value cost-value">${nextCost.toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Benefit:</span>
                        <span class="info-value">+${upgrade.benefit}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Total Spent:</span>
                        <span class="info-value">${totalCost.toLocaleString()}</span>
                    </div>
                </div>
                <p class="description">${upgrade.description || 'No description available'}</p>
                <button id="buyRecommendation" class="btn-primary" style="width: 100%; margin-top: 15px;">
                    <i class="fas fa-shopping-cart"></i> Buy This Upgrade
                </button>
            </div>
        `;
        
        document.getElementById('buyRecommendation').addEventListener('click', () => {
            this.incrementLevel(upgradeName);
        });
    }

    calculateTotalSpent(upgradeName) {
        let total = 0;
        const currentLevel = this.levels[upgradeName];
        
        for (let level = 1; level <= currentLevel; level++) {
            total += this.calculateCost(upgradeName, level);
        }
        
        return total;
    }

    incrementLevel(upgradeName) {
        const currentLevel = this.levels[upgradeName];
        const nextCost = this.calculateCost(upgradeName, currentLevel + 1);
        
        if (nextCost > this.availableMoney) {
            alert(`Not enough money! Need ${nextCost}, have ${this.availableMoney}`);
            return;
        }
        
        if (currentLevel >= this.upgrades[upgradeName].maxLevel) {
            alert('Maximum level reached!');
            return;
        }
        
        this.levels[upgradeName]++;
        this.availableMoney -= nextCost;
        
        document.getElementById('moneyInput').value = this.availableMoney;
        
        this.renderUpgrades();
        this.calculateBestUpgrade();
        this.saveToStorage();
    }

    decrementLevel(upgradeName) {
        if (this.levels[upgradeName] > 0) {
            const currentLevel = this.levels[upgradeName];
            const cost = this.calculateCost(upgradeName, currentLevel);
            
            this.levels[upgradeName]--;
            this.availableMoney += Math.floor(cost * 0.8); // Refund 80%
            
            document.getElementById('moneyInput').value = this.availableMoney;
            
            this.renderUpgrades();
            this.calculateBestUpgrade();
            this.saveToStorage();
        }
    }

    setLevel(upgradeName, level) {
        const parsedLevel = parseInt(level);
        const maxLevel = this.upgrades[upgradeName].maxLevel;
        
        if (isNaN(parsedLevel) || parsedLevel < 0) {
            this.levels[upgradeName] = 0;
        } else if (parsedLevel > maxLevel) {
            this.levels[upgradeName] = maxLevel;
        } else {
            this.levels[upgradeName] = parsedLevel;
        }
        
        this.renderUpgrades();
        this.saveToStorage();
    }

    renderUpgrades() {
        const container = document.getElementById('upgradesContainer');
        container.innerHTML = '';
        
        let totalLevels = 0;
        let totalSpent = 0;
        
        Object.entries(this.upgrades).forEach(([name, data]) => {
            const currentLevel = this.levels[name];
            const nextCost = this.calculateCost(name, currentLevel + 1);
            const totalCost = this.calculateTotalSpent(name);
            const efficiency = data.benefit / nextCost;
            
            totalLevels += currentLevel;
            totalSpent += totalCost;
            
            const card = document.createElement('div');
            card.className = `upgrade-card ${this.recommendation === name ? 'recommended' : ''}`;
            
            card.innerHTML = `
                <div class="upgrade-header">
                    <div class="upgrade-name">${name}</div>
                    <div class="upgrade-level">Lvl ${currentLevel} / ${data.maxLevel}</div>
                </div>
                
                <div class="upgrade-info">
                    <div class="info-row">
                        <span class="info-label">Base Cost:</span>
                        <span class="info-value">${data.baseCost.toLocaleString()}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Next Cost:</span>
                        <span class="info-value cost-value">${nextCost.toLocaleString()}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Benefit:</span>
                        <span class="info-value">+${data.benefit}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Efficiency:</span>
                        <span class="info-value efficiency-value">${efficiency.toFixed(4)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Total Spent:</span>
                        <span class="info-value">${totalCost.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="level-controls">
                    <button class="level-btn decrement" data-upgrade="${name}">-</button>
                    <input type="number" class="level-input" value="${currentLevel}" 
                           min="0" max="${data.maxLevel}" data-upgrade="${name}">
                    <button class="level-btn increment" data-upgrade="${name}">+</button>
                </div>
                
                ${data.description ? `<p class="description">${data.description}</p>` : ''}
            `;
            
            container.appendChild(card);
            
            // Add event listeners for this card
            const incrementBtn = card.querySelector('.increment');
            const decrementBtn = card.querySelector('.decrement');
            const levelInput = card.querySelector('.level-input');
            
            incrementBtn.addEventListener('click', () => this.incrementLevel(name));
            decrementBtn.addEventListener('click', () => this.decrementLevel(name));
            levelInput.addEventListener('change', (e) => this.setLevel(name, e.target.value));
            levelInput.addEventListener('input', (e) => this.setLevel(name, e.target.value));
        });
        
        // Update totals
        document.getElementById('totalLevels').textContent = totalLevels;
        document.getElementById('totalSpent').textContent = totalSpent.toLocaleString();
    }

    saveProgress() {
        const data = {
            levels: this.levels,
            money: this.availableMoney,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `bubba-progress-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Progress saved!');
    }

    importFromJson() {
        const jsonInput = document.getElementById('jsonInput').value;
        
        try {
            const data = JSON.parse(jsonInput);
            
            if (data.levels) {
                this.levels = data.levels;
            }
            
            if (data.money) {
                this.availableMoney = data.money;
                document.getElementById('moneyInput').value = this.availableMoney;
            }
            
            this.renderUpgrades();
            this.saveToStorage();
            alert('Data imported successfully!');
            
        } catch (error) {
            alert('Invalid JSON format!');
            console.error(error);
        }
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.bubbaOptimizer = new BubbaOptimizer();
});
