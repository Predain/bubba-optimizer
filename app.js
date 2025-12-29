class BubbaOptimizer {
    constructor() {
        this.upgrades = {};
        this.levels = {};
        this.availableMoney = 1000000;
        this.currentDps = 0;
        this.strategy = 'dpsPerCost';
        this.recommendation = null;
        this.ignoredRecommendations = new Set();
        
        this.init();
    }

    async init() {
        this.showLoading();
        
        try {
            // Try to load data from Google Sheets
            await this.loadFromGoogleSheets();
        } catch (error) {
            console.error('Failed to load from Google Sheets:', error);
            
            // Use built-in sample data
            await this.loadSampleData();
            this.showNotification('Using sample data. Click "Load from Google Sheets" to try again.', 'info');
        }
        
        // Load saved state
        this.loadFromStorage();
        
        // Setup UI
        this.setupEventListeners();
        this.renderTable();
        this.calculateDps();
        this.findBestUpgrade();
        
        this.hideLoading();
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode === container) {
                container.removeChild(notification);
            }
        }, 3000);
    }

    async loadFromGoogleSheets() {
        // Your Google Sheets CSV URL
        const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTV0t6SXTEs2ndKMVlnBssVfGQEIKZB-F5mDzLN3u7FLrOcWuslmlxITJ0T3_VONJzy7GsBi9ARQbEF/pub?output=csv';
        
        try {
            // Try direct fetch
            const response = await fetch(csvUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const csvText = await response.text();
            
            if (!csvText || csvText.trim().length < 10) {
                throw new Error('Empty CSV response');
            }
            
            this.parseCSV(csvText);
            this.showNotification('Data loaded from Google Sheets', 'success');
            
        } catch (error) {
            console.warn('Failed to load from Google Sheets:', error);
            throw error;
        }
    }

    parseCSV(csvText) {
        const rows = csvText.split('\n')
            .map(row => row.trim())
            .filter(row => row && !row.startsWith('//'));
        
        console.log('CSV rows to parse:', rows);
        
        // Skip header row if it exists
        let startIndex = 0;
        if (rows[0] && rows[0].includes('Upgrade') && rows[0].includes('Base Cost')) {
            startIndex = 1;
        }
        
        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            // Simple CSV parsing - split by comma
            const cells = row.split(',').map(cell => cell.trim().replace(/"/g, ''));
            
            if (cells.length >= 3) {
                const name = cells[0];
                const baseCost = parseFloat(cells[1]) || 0;
                const dps = parseFloat(cells[2]) || 0;
                const maxLevel = parseInt(cells[3]) || 100;
                const description = cells[4] || '';
                
                if (name && baseCost > 0) {
                    this.upgrades[name] = {
                        baseCost: baseCost,
                        dps: dps,
                        maxLevel: maxLevel,
                        description: description,
                        category: this.determineCategory(name)
                    };
                    
                    // Initialize level to 0 if not already set
                    if (this.levels[name] === undefined) {
                        this.levels[name] = 0;
                    }
                }
            }
        }
        
        console.log('Parsed upgrades:', this.upgrades);
    }

    async loadSampleData() {
        // Sample data based on typical Bubba upgrades
        this.upgrades = {
            "Bubbles": {
                baseCost: 50,
                dps: 0.02,
                maxLevel: 175,
                description: "Increases bubble damage by 0.02 per level",
                category: "damage"
            },
            "Bubble Breakthrough": {
                baseCost: 100,
                dps: 0.10,
                maxLevel: 90,
                description: "Significant DPS increase per level",
                category: "damage"
            },
            "Bubble Boost": {
                baseCost: 250,
                dps: 0.02,
                maxLevel: 120,
                description: "Improves bubble spawn rate",
                category: "utility"
            },
            "More Bubbles": {
                baseCost: 2000,
                dps: 1.00,
                maxLevel: 45,
                description: "Increases maximum bubbles on screen",
                category: "utility"
            },
            "Bubble Bonanza": {
                baseCost: 5000,
                dps: 0.05,
                maxLevel: 25,
                description: "Chance for double bubble spawn",
                category: "special"
            },
            "Golden Bubbles": {
                baseCost: 10000,
                dps: 0.15,
                maxLevel: 20,
                description: "Bubbles drop more money",
                category: "money"
            },
            "Bubble Speed": {
                baseCost: 500,
                dps: 0.01,
                maxLevel: 100,
                description: "Increases bubble movement speed",
                category: "utility"
            },
            "Critical Bubbles": {
                baseCost: 2500,
                dps: 0.25,
                maxLevel: 50,
                description: "Chance for critical bubble hits",
                category: "damage"
            },
            "Money Bubbles": {
                baseCost: 5000,
                dps: 0.10,
                maxLevel: 30,
                description: "Extra money from popped bubbles",
                category: "money"
            }
        };
        
        // Initialize levels
        Object.keys(this.upgrades).forEach(name => {
            if (this.levels[name] === undefined) {
                this.levels[name] = 0;
            }
        });
        
        console.log('Loaded sample data');
    }

    determineCategory(upgradeName) {
        const name = upgradeName.toLowerCase();
        
        if (name.includes('bubble') && name.includes('break')) return 'damage';
        if (name.includes('damage') || name.includes('dps') || name.includes('critical')) return 'damage';
        if (name.includes('money') || name.includes('gold') || name.includes('coin') || name.includes('lucky')) return 'money';
        if (name.includes('speed') || name.includes('rate') || name.includes('time') || name.includes('boost')) return 'utility';
        if (name.includes('special') || name.includes('bonus') || name.includes('chain') || name.includes('bonanza')) return 'special';
        
        return 'damage';
    }

    loadFromStorage() {
        try {
            const savedLevels = localStorage.getItem('bubbaLevels');
            const savedMoney = localStorage.getItem('bubbaMoney');
            const savedStrategy = localStorage.getItem('bubbaStrategy');
            
            if (savedLevels) {
                this.levels = JSON.parse(savedLevels);
            }
            
            if (savedMoney) {
                this.availableMoney = parseInt(savedMoney);
                const moneyInput = document.getElementById('moneyInput');
                if (moneyInput) moneyInput.value = this.availableMoney;
            }
            
            if (savedStrategy) {
                this.strategy = savedStrategy;
                const radio = document.querySelector(`input[value="${savedStrategy}"]`);
                if (radio) radio.checked = true;
            }
        } catch (error) {
            console.error('Failed to load from storage:', error);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('bubbaLevels', JSON.stringify(this.levels));
            localStorage.setItem('bubbaMoney', this.availableMoney.toString());
            localStorage.setItem('bubbaStrategy', this.strategy);
        } catch (error) {
            console.error('Failed to save to storage:', error);
        }
    }

    setupEventListeners() {
        // Money input
        const moneyInput = document.getElementById('moneyInput');
        if (moneyInput) {
            moneyInput.addEventListener('input', (e) => {
                this.availableMoney = parseInt(e.target.value) || 0;
                this.saveToStorage();
                this.findBestUpgrade();
            });
        }

        // Strategy selection
        document.querySelectorAll('input[name="strategy"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.strategy = e.target.value;
                this.saveToStorage();
                this.findBestUpgrade();
            });
        });

        // Calculate button
        const calculateBtn = document.getElementById('calculateBtn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => {
                this.findBestUpgrade();
                this.showNotification('Recalculated best upgrades', 'info');
            });
        }

        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Reset all levels to 0?')) {
                    Object.keys(this.levels).forEach(name => {
                        this.levels[name] = 0;
                    });
                    this.renderTable();
                    this.calculateDps();
                    this.findBestUpgrade();
                    this.saveToStorage();
                    this.showNotification('All levels reset to 0', 'success');
                }
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Import button
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const importTab = document.querySelector('.tab-btn[data-tab="import"]');
                if (importTab) importTab.click();
            });
        }

        // Load JSON button
        const loadJsonBtn = document.getElementById('loadJsonBtn');
        if (loadJsonBtn) {
            loadJsonBtn.addEventListener('click', () => {
                this.importFromJson();
            });
        }

        // Load file button
        const loadFileBtn = document.getElementById('loadFileBtn');
        if (loadFileBtn) {
            loadFileBtn.addEventListener('click', () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.json';
                fileInput.onchange = (e) => {
                    if (e.target.files.length > 0) {
                        this.loadFromFile(e.target.files[0]);
                    }
                };
                fileInput.click();
            });
        }

        // Clear JSON button
        const clearJsonBtn = document.getElementById('clearJsonBtn');
        if (clearJsonBtn) {
            clearJsonBtn.addEventListener('click', () => {
                const jsonInput = document.getElementById('jsonInput');
                if (jsonInput) jsonInput.value = '';
            });
        }

        // Copy JSON button
        const copyJsonBtn = document.getElementById('copyJsonBtn');
        if (copyJsonBtn) {
            copyJsonBtn.addEventListener('click', () => {
                this.copyToClipboard();
            });
        }

        // Save JSON button
        const saveJsonBtn = document.getElementById('saveJsonBtn');
        if (saveJsonBtn) {
            saveJsonBtn.addEventListener('click', () => {
                this.downloadJson();
            });
        }

        // Clear all button
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm('Clear all data including saved progress?')) {
                    localStorage.clear();
                    location.reload();
                }
            });
        }

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                
                // Update active tab
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Show corresponding content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                const tabContent = document.getElementById(`${tab}Tab`);
                if (tabContent) tabContent.classList.add('active');
                
                // Update export preview
                if (tab === 'export') {
                    this.updateExportPreview();
                }
            });
        });

        // Help button
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                const modal = document.getElementById('helpModal');
                if (modal) modal.style.display = 'flex';
            });
        }

        // Modal close
        const modalClose = document.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                const modal = document.getElementById('helpModal');
                if (modal) modal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') {
                const modal = document.getElementById('helpModal');
                if (modal) modal.style.display = 'none';
            }
        });

        // Filters
        const filterAffordable = document.getElementById('filterAffordable');
        if (filterAffordable) {
            filterAffordable.addEventListener('change', () => {
                this.renderTable();
            });
        }

        const filterMaxLevel = document.getElementById('filterMaxLevel');
        if (filterMaxLevel) {
            filterMaxLevel.addEventListener('change', () => {
                this.renderTable();
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderTable();
            });
        }

        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.renderTable();
            });
        }

        // Buy recommendation button
        const buyRecBtn = document.getElementById('buyRecBtn');
        if (buyRecBtn) {
            buyRecBtn.addEventListener('click', () => {
                this.buyRecommendation();
            });
        }

        // Ignore recommendation button
        const ignoreRecBtn = document.getElementById('ignoreRecBtn');
        if (ignoreRecBtn) {
            ignoreRecBtn.addEventListener('click', () => {
                this.ignoreRecommendation();
            });
        }
    }

    calculateCost(upgradeName, level) {
        const baseCost = this.upgrades[upgradeName]?.baseCost || 0;
        return Math.floor(baseCost * Math.pow(1.15, level - 1));
    }

    calculateTotalSpent(upgradeName) {
        let total = 0;
        const currentLevel = this.levels[upgradeName] || 0;
        
        for (let level = 1; level <= currentLevel; level++) {
            total += this.calculateCost(upgradeName, level);
        }
        
        return total;
    }

    calculateDps() {
        let totalDps = 0;
        
        Object.entries(this.upgrades).forEach(([name, data]) => {
            const level = this.levels[name] || 0;
            totalDps += data.dps * level;
        });
        
        this.currentDps = totalDps;
        
        // Update UI
        const currentDpsElem = document.getElementById('currentDps');
        if (currentDpsElem) currentDpsElem.textContent = totalDps.toFixed(2);
        
        return totalDps;
    }

    calculateNewDps(upgradeName) {
        let newDps = 0;
        
        Object.entries(this.upgrades).forEach(([name, data]) => {
            let level = this.levels[name] || 0;
            
            if (name === upgradeName) {
                level += 1;
            }
            
            newDps += data.dps * level;
        });
        
        return newDps;
    }

    findBestUpgrade() {
        const moneyInput = document.getElementById('moneyInput');
        if (moneyInput) {
            this.availableMoney = parseInt(moneyInput.value) || 0;
        }
        
        let bestUpgrade = null;
        let bestValue = -Infinity;
        
        Object.entries(this.upgrades).forEach(([name, data]) => {
            const currentLevel = this.levels[name] || 0;
            
            // Skip if at max level
            if (currentLevel >= data.maxLevel) return;
            
            // Skip ignored recommendations
            if (this.ignoredRecommendations.has(name)) return;
            
            const nextCost = this.calculateCost(name, currentLevel + 1);
            
            // Skip if not affordable (unless we're ignoring affordability)
            const filterAffordable = document.getElementById('filterAffordable');
            if (filterAffordable?.checked && nextCost > this.availableMoney) {
                return;
            }
            
            let value;
            switch(this.strategy) {
                case 'dpsPerCost':
                    value = data.dps / nextCost;
                    break;
                case 'dps':
                    value = data.dps;
                    break;
                case 'totalDamage':
                    value = data.dps * (currentLevel + 1);
                    break;
                case 'cost':
                    value = 1 / nextCost;
                    break;
                default:
                    value = data.dps / nextCost;
            }
            
            if (value > bestValue) {
                bestValue = value;
                bestUpgrade = name;
            }
        });
        
        this.recommendation = bestUpgrade;
        this.showRecommendation(bestUpgrade);
        this.renderTable();
    }

    showRecommendation(upgradeName) {
        const panel = document.getElementById('recommendationPanel');
        
        if (!upgradeName) {
            if (panel) panel.style.display = 'none';
            return;
        }
        
        if (panel) panel.style.display = 'block';
        
        const upgrade = this.upgrades[upgradeName];
        if (!upgrade) return;
        
        const currentLevel = this.levels[upgradeName] || 0;
        const nextCost = this.calculateCost(upgradeName, currentLevel + 1);
        const dpsIncrease = upgrade.dps;
        const dpsPerCost = upgrade.dps / nextCost;
        const affordable = nextCost <= this.availableMoney;
        
        // Update recommendation card
        const recName = document.getElementById('recName');
        if (recName) recName.textContent = upgradeName;
        
        const recCurrentLevel = document.getElementById('recCurrentLevel');
        if (recCurrentLevel) recCurrentLevel.textContent = `${currentLevel} / ${upgrade.maxLevel}`;
        
        const recNextCost = document.getElementById('recNextCost');
        if (recNextCost) recNextCost.textContent = nextCost.toLocaleString();
        
        const recDpsIncrease = document.getElementById('recDpsIncrease');
        if (recDpsIncrease) recDpsIncrease.textContent = dpsIncrease.toFixed(4);
        
        const recDpsPerCost = document.getElementById('recDpsPerCost');
        if (recDpsPerCost) recDpsPerCost.textContent = dpsPerCost.toFixed(6);
        
        const recAffordable = document.getElementById('recAffordable');
        if (recAffordable) {
            recAffordable.textContent = affordable ? 'Yes' : 'No';
            recAffordable.style.color = affordable ? '#27ae60' : '#e74c3c';
        }
        
        // Update DPS stats
        const newDps = this.calculateNewDps(upgradeName);
        const dpsIncreasePercent = this.currentDps > 0 ? 
            ((newDps - this.currentDps) / this.currentDps * 100).toFixed(2) : '100.00';
        
        const newDpsElem = document.getElementById('newDps');
        if (newDpsElem) newDpsElem.textContent = newDps.toFixed(2);
        
        const dpsIncreaseElem = document.getElementById('dpsIncrease');
        if (dpsIncreaseElem) {
            dpsIncreaseElem.textContent = `${dpsIncreasePercent}%`;
            dpsIncreaseElem.style.color = parseFloat(dpsIncreasePercent) > 0 ? '#27ae60' : '#e74c3c';
        }
    }

    buyRecommendation() {
        if (!this.recommendation) return;
        
        const upgradeName = this.recommendation;
        const currentLevel = this.levels[upgradeName] || 0;
        const nextCost = this.calculateCost(upgradeName, currentLevel + 1);
        
        if (nextCost > this.availableMoney) {
            this.showNotification(`Not enough money! Need ${nextCost.toLocaleString()}`, 'error');
            return;
        }
        
        this.levels[upgradeName] = currentLevel + 1;
        this.availableMoney -= nextCost;
        
        // Update money input
        const moneyInput = document.getElementById('moneyInput');
        if (moneyInput) moneyInput.value = this.availableMoney;
        
        // Recalculate
        this.calculateDps();
        this.findBestUpgrade();
        this.saveToStorage();
        
        this.showNotification(`Purchased ${upgradeName} level ${currentLevel + 1} for ${nextCost.toLocaleString()}`, 'success');
    }

    ignoreRecommendation() {
        if (!this.recommendation) return;
        
        this.ignoredRecommendations.add(this.recommendation);
        this.findBestUpgrade();
        
        this.showNotification(`Ignored ${this.recommendation} for this session`, 'info');
    }

    incrementLevel(upgradeName, amount = 1) {
        const currentLevel = this.levels[upgradeName] || 0;
        const maxLevel = this.upgrades[upgradeName]?.maxLevel || 100;
        
        if (currentLevel >= maxLevel) {
            this.showNotification(`${upgradeName} is already at max level!`, 'warning');
            return;
        }
        
        // Calculate total cost for the levels we want to add
        let totalCost = 0;
        for (let i = 1; i <= amount; i++) {
            const level = currentLevel + i;
            if (level > maxLevel) break;
            totalCost += this.calculateCost(upgradeName, level);
        }
        
        if (totalCost > this.availableMoney) {
            this.showNotification(`Need ${totalCost.toLocaleString()} money for ${amount} levels!`, 'error');
            return;
        }
        
        this.levels[upgradeName] = Math.min(currentLevel + amount, maxLevel);
        this.availableMoney -= totalCost;
        
        // Update UI
        const moneyInput = document.getElementById('moneyInput');
        if (moneyInput) moneyInput.value = this.availableMoney;
        
        // Recalculate
        this.calculateDps();
        this.findBestUpgrade();
        this.saveToStorage();
        
        this.showNotification(`Added ${amount} level(s) to ${upgradeName}`, 'success');
    }

    decrementLevel(upgradeName, amount = 1) {
        const currentLevel = this.levels[upgradeName] || 0;
        
        if (currentLevel === 0) return;
        
        const newLevel = Math.max(0, currentLevel - amount);
        
        // Calculate refund (80% of cost)
        let refund = 0;
        for (let i = currentLevel; i > newLevel; i--) {
            const cost = this.calculateCost(upgradeName, i);
            refund += Math.floor(cost * 0.8);
        }
        
        this.levels[upgradeName] = newLevel;
        this.availableMoney += refund;
        
        // Update UI
        const moneyInput = document.getElementById('moneyInput');
        if (moneyInput) moneyInput.value = this.availableMoney;
        
        // Recalculate
        this.calculateDps();
        this.findBestUpgrade();
        this.saveToStorage();
        
        this.showNotification(`Refunded ${refund.toLocaleString()} from ${upgradeName}`, 'info');
    }

    setLevel(upgradeName, level) {
        const parsedLevel = parseInt(level);
        const maxLevel = this.upgrades[upgradeName]?.maxLevel || 100;
        
        if (isNaN(parsedLevel)) return;
        
        const newLevel = Math.max(0, Math.min(parsedLevel, maxLevel));
        const currentLevel = this.levels[upgradeName] || 0;
        
        if (newLevel === currentLevel) return;
        
        if (newLevel > currentLevel) {
            // Buying levels
            let totalCost = 0;
            for (let i = currentLevel + 1; i <= newLevel; i++) {
                totalCost += this.calculateCost(upgradeName, i);
            }
            
            if (totalCost > this.availableMoney) {
                this.showNotification(`Need ${totalCost.toLocaleString()} money!`, 'error');
                this.renderTable(); // Reset input to current level
                return;
            }
            
            this.levels[upgradeName] = newLevel;
            this.availableMoney -= totalCost;
            
        } else {
            // Selling levels
            let refund = 0;
            for (let i = currentLevel; i > newLevel; i--) {
                const cost = this.calculateCost(upgradeName, i);
                refund += Math.floor(cost * 0.8);
            }
            
            this.levels[upgradeName] = newLevel;
            this.availableMoney += refund;
        }
        
        // Update UI
        const moneyInput = document.getElementById('moneyInput');
        if (moneyInput) moneyInput.value = this.availableMoney;
        
        // Recalculate
        this.calculateDps();
        this.findBestUpgrade();
        this.saveToStorage();
    }

    renderTable() {
        const tbody = document.getElementById('upgradesBody');
        if (!tbody) {
            console.error('Table body not found!');
            return;
        }
        
        tbody.innerHTML = '';
        
        let totalLevels = 0;
        let totalSpent = 0;
        let totalDps = 0;
        
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const categoryFilter = document.getElementById('categoryFilter');
        const category = categoryFilter ? categoryFilter.value : 'all';
        const filterAffordable = document.getElementById('filterAffordable');
        const showOnlyAffordable = filterAffordable ? filterAffordable.checked : false;
        const filterMaxLevel = document.getElementById('filterMaxLevel');
        const hideMaxLevel = filterMaxLevel ? filterMaxLevel.checked : false;
        
        // If no upgrades loaded, show message
        if (Object.keys(this.upgrades).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px;">
                        <h3>No upgrades loaded</h3>
                        <p>Try reloading the page or check the console for errors.</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        Object.entries(this.upgrades)
            .filter(([name, data]) => {
                // Apply filters
                if (searchTerm && !name.toLowerCase().includes(searchTerm) && 
                    !data.description.toLowerCase().includes(searchTerm)) {
                    return false;
                }
                
                if (category !== 'all' && data.category !== category) {
                    return false;
                }
                
                const currentLevel = this.levels[name] || 0;
                
                if (hideMaxLevel && currentLevel >= data.maxLevel) {
                    return false;
                }
                
                if (showOnlyAffordable) {
                    const nextCost = this.calculateCost(name, currentLevel + 1);
                    if (nextCost > this.availableMoney) {
                        return false;
                    }
                }
                
                return true;
            })
            .sort(([nameA], [nameB]) => {
                // Sort by recommendation status first, then by name
                const aRec = nameA === this.recommendation;
                const bRec = nameB === this.recommendation;
                
                if (aRec && !bRec) return -1;
                if (!aRec && bRec) return 1;
                
                return nameA.localeCompare(nameB);
            })
            .forEach(([name, data]) => {
                const currentLevel = this.levels[name] || 0;
                const nextCost = this.calculateCost(name, currentLevel + 1);
                const totalCost = this.calculateTotalSpent(name);
                const dpsGain = data.dps;
                const dpsPerCost = data.dps / nextCost;
                const currentDps = data.dps * currentLevel;
                const isMaxLevel = currentLevel >= data.maxLevel;
                const isRecommended = name === this.recommendation;
                const isAffordable = nextCost <= this.availableMoney;
                
                totalLevels += currentLevel;
                totalSpent += totalCost;
                totalDps += currentDps;
                
                const row = document.createElement('tr');
                if (isRecommended) row.classList.add('recommended');
                if (isMaxLevel) row.classList.add('max-level');
                
                row.innerHTML = `
                    <td>
                        <div class="upgrade-name">
                            ${name}
                            ${data.description ? `<div class="upgrade-desc">${data.description}</div>` : ''}
                        </div>
                    </td>
                    <td>
                        <div class="level-controls">
                            <button class="level-btn decrement" data-upgrade="${name}">-</button>
                            <input type="number" class="level-input" value="${currentLevel}" 
                                   min="0" max="${data.maxLevel}" data-upgrade="${name}">
                            <button class="level-btn increment" data-upgrade="${name}">+</button>
                            <div class="quick-buttons">
                                <button class="quick-btn" data-upgrade="${name}" data-amount="10">+10</button>
                                <button class="quick-btn" data-upgrade="${name}" data-amount="max">MAX</button>
                            </div>
                        </div>
                    </td>
                    <td class="cost-value">${data.baseCost.toLocaleString()}</td>
                    <td class="cost-value ${isAffordable ? '' : 'unaffordable'}">
                        ${nextCost.toLocaleString()}
                        ${!isAffordable ? '<br><small>(Need more money)</small>' : ''}
                    </td>
                    <td class="dps-value">${dpsGain.toFixed(4)}</td>
                    <td class="dps-per-cost">${dpsPerCost.toFixed(6)}</td>
                    <td class="dps-value">${currentDps.toFixed(2)}</td>
                    <td>
                        <div class="level-info">
                            ${isMaxLevel ? 
                                '<span class="max-level-badge">MAX</span>' : 
                                `${currentLevel} / ${data.maxLevel}`}
                        </div>
                    </td>
                    <td class="recommendation-cell">
                        ${isRecommended ? 
                            '<button class="recommend-btn"><i class="fas fa-star"></i> Best</button>' : 
                            '<span class="recommend-badge">-</span>'}
                    </td>
                `;
                
                tbody.appendChild(row);
                
                // Add event listeners for this row
                const incrementBtn = row.querySelector('.increment');
                const decrementBtn = row.querySelector('.decrement');
                const levelInput = row.querySelector('.level-input');
                const quickButtons = row.querySelectorAll('.quick-btn');
                
                if (incrementBtn) {
                    incrementBtn.addEventListener('click', () => this.incrementLevel(name, 1));
                }
                
                if (decrementBtn) {
                    decrementBtn.addEventListener('click', () => this.decrementLevel(name, 1));
                }
                
                if (levelInput) {
                    levelInput.addEventListener('change', (e) => this.setLevel(name, e.target.value));
                    levelInput.addEventListener('blur', (e) => {
                        if (e.target.value === '') {
                            e.target.value = currentLevel;
                        }
                    });
                }
                
                quickButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const amount = e.target.dataset.amount;
                        if (amount === 'max') {
                            this.setLevel(name, data.maxLevel);
                        } else {
                            this.incrementLevel(name, parseInt(amount));
                        }
                    });
                });
            });
        
        // Update summary
        const totalLevelsElem = document.getElementById('totalLevels');
        if (totalLevelsElem) totalLevelsElem.textContent = totalLevels;
        
        const totalSpentElem = document.getElementById('totalSpent');
        if (totalSpentElem) totalSpentElem.textContent = totalSpent.toLocaleString();
        
        const totalDpsElem = document.getElementById('totalDps');
        if (totalDpsElem) totalDpsElem.textContent = totalDps.toFixed(2);
        
        // Update current DPS
        const currentDpsElem = document.getElementById('currentDps');
        if (currentDpsElem) currentDpsElem.textContent = totalDps.toFixed(2);
        
        this.currentDps = totalDps;
    }

    exportData() {
        const data = {
            money: this.availableMoney,
            levels: this.levels,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const jsonStr = JSON.stringify(data, null, 2);
        
        // Update export preview
        const jsonOutput = document.getElementById('jsonOutput');
        if (jsonOutput) {
            jsonOutput.value = jsonStr;
        }
        
        // Switch to export tab
        const exportTab = document.querySelector('.tab-btn[data-tab="export"]');
        if (exportTab) exportTab.click();
        
        this.showNotification('Data exported to JSON', 'success');
    }

    updateExportPreview() {
        const data = {
            money: this.availableMoney,
            levels: this.levels,
            timestamp: new Date().toISOString()
        };
        
        const jsonOutput = document.getElementById('jsonOutput');
        if (jsonOutput) {
            jsonOutput.value = JSON.stringify(data, null, 2);
        }
    }

    importFromJson() {
        const jsonInput = document.getElementById('jsonInput');
        if (!jsonInput) return;
        
        const jsonText = jsonInput.value;
        
        if (!jsonText.trim()) {
            this.showNotification('Please paste JSON data first', 'error');
            return;
        }
        
        try {
            const data = JSON.parse(jsonText);
            
            if (data.levels) {
                // Only update levels for upgrades that exist
                Object.keys(data.levels).forEach(name => {
                    if (this.upgrades[name] !== undefined) {
                        this.levels[name] = Math.min(data.levels[name], this.upgrades[name].maxLevel);
                    }
                });
            }
            
            if (data.money !== undefined) {
                this.availableMoney = data.money;
                const moneyInput = document.getElementById('moneyInput');
                if (moneyInput) moneyInput.value = this.availableMoney;
            }
            
            // Reset ignored recommendations
            this.ignoredRecommendations.clear();
            
            // Update UI
            this.renderTable();
            this.calculateDps();
            this.findBestUpgrade();
            this.saveToStorage();
            
            this.showNotification('Data imported successfully!', 'success');
            
        } catch (error) {
            this.showNotification('Invalid JSON format!', 'error');
            console.error(error);
        }
    }

    async loadFromFile(file) {
        if (!file) return;
        
        try {
            const text = await file.text();
            const jsonInput = document.getElementById('jsonInput');
            if (jsonInput) jsonInput.value = text;
            this.importFromJson();
        } catch (error) {
            this.showNotification('Failed to read file', 'error');
            console.error(error);
        }
    }

    copyToClipboard() {
        const textarea = document.getElementById('jsonOutput');
        if (!textarea) return;
        
        textarea.select();
        textarea.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            this.showNotification('Copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showNotification('Failed to copy to clipboard', 'error');
        }
    }

    downloadJson() {
        const data = {
            money: this.availableMoney,
            levels: this.levels,
            timestamp: new Date().toISOString()
        };
        
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `bubba-progress-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('File downloaded!', 'success');
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'flex';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing optimizer...');
    window.bubbaOptimizer = new BubbaOptimizer();
});

// Add error handling for the page
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Hide loading screen on error
    const loading = document.getElementById('loading');
    if (loading) {
        loading.innerHTML = `
            <div class="loading-content">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading optimizer</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Check console for details</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Reload Page
                </button>
            </div>
        `;
    }
});
