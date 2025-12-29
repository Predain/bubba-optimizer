class BubbaOptimizer {
    constructor() {
        this.upgrades = {};
        this.levels = {};
        this.availableMoney = 1000000;
        this.currentDps = 0;
        this.strategy = 'dpsPerCost';
        this.recommendation = null;
        this.ignoredRecommendations = new Set();
        
        // Initialize toastr
        toastr.options = {
            positionClass: 'toast-top-right',
            progressBar: true,
            timeOut: 3000
        };
        
        this.init();
    }

    async init() {
        this.showLoading();
        
        try {
            // Try to load data from Google Sheets using proxy
            await this.loadFromGoogleSheets();
        } catch (error) {
            console.error('Failed to load from Google Sheets:', error);
            
            // Use built-in sample data that matches your sheet
            await this.loadSampleData();
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

    async loadFromGoogleSheets() {
        // Using CORS proxy to avoid CORS issues
        const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTV0t6SXTEs2ndKMVlnBssVfGQEIKZB-F5mDzLN3u7FLrOcWuslmlxITJ0T3_VONJzy7GsBi9ARQbEF/pub?output=csv';
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/'; // CORS proxy
        
        try {
            const response = await fetch(proxyUrl + csvUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const csvText = await response.text();
            
            if (!csvText || csvText.trim().length < 10) {
                throw new Error('Empty CSV response');
            }
            
            this.parseCSV(csvText);
            toastr.success('Data loaded from Google Sheets');
            
        } catch (error) {
            console.warn('CORS proxy failed, trying direct fetch:', error);
            
            // Try direct fetch as fallback
            try {
                const response = await fetch(csvUrl);
                const csvText = await response.text();
                this.parseCSV(csvText);
                toastr.success('Data loaded from Google Sheets');
            } catch (directError) {
                console.warn('Direct fetch also failed:', directError);
                throw new Error('Failed to load from Google Sheets');
            }
        }
    }

    parseCSV(csvText) {
        // Clean and parse CSV
        const rows = csvText.split('\n')
            .map(row => row.trim())
            .filter(row => row && !row.startsWith('//') && row !== 'Upgrade,Base Cost,DPS Increase,Max Level,Description');
        
        if (rows.length === 0) {
            throw new Error('No valid data in CSV');
        }
        
        console.log('CSV rows to parse:', rows.length);
        
        // Parse each row
        rows.forEach((row, index) => {
            // Handle CSV with quotes and commas
            let cells = [];
            let currentCell = '';
            let insideQuotes = false;
            
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                
                if (char === '"') {
                    insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                    cells.push(currentCell.trim());
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            cells.push(currentCell.trim());
            
            // Remove quotes from cells
            cells = cells.map(cell => cell.replace(/^"|"$/g, ''));
            
            // Expecting: Name, Base Cost, DPS, Max Level, Description
            if (cells.length >= 4) {
                const name = cells[0];
                const baseCost = parseFloat(cells[1].replace(/[^0-9.]/g, '')) || 0;
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
        });
        
        console.log('Parsed upgrades:', this.upgrades);
    }

    async loadSampleData() {
        // Sample data that should match your sheet
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
            },
            "Super Bubbles": {
                baseCost: 100000,
                dps: 5.00,
                maxLevel: 10,
                description: "Massive DPS increase",
                category: "damage"
            },
            "Bubble Chain": {
                baseCost: 15000,
                dps: 0.50,
                maxLevel: 25,
                description: "Chance for chain reactions",
                category: "special"
            },
            "Lucky Bubbles": {
                baseCost: 7500,
                dps: 0.08,
                maxLevel: 40,
                description: "Increased rare bubble chance",
                category: "special"
            }
        };
        
        // Initialize levels
        Object.keys(this.upgrades).forEach(name => {
            if (this.levels[name] === undefined) {
                this.levels[name] = 0;
            }
        });
        
        console.log('Loaded sample data');
        toastr.info('Using sample data. Click "Load from Google Sheets" to try again.');
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
                document.getElementById('moneyInput').value = this.availableMoney;
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
        document.getElementById('moneyInput').addEventListener('input', (e) => {
            this.availableMoney = parseInt(e.target.value) || 0;
            this.saveToStorage();
            this.findBestUpgrade();
        });

        // Strategy selection
        document.querySelectorAll('input[name="strategy"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.strategy = e.target.value;
                this.saveToStorage();
                this.findBestUpgrade();
            });
        });

        // Calculate button
        document.getElementById('calculateBtn').addEventListener('click', () => {
            this.findBestUpgrade();
            toastr.info('Recalculated best upgrades');
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('Reset all levels to 0?')) {
                Object.keys(this.levels).forEach(name => {
                    this.levels[name] = 0;
                });
                this.renderTable();
                this.calculateDps();
                this.findBestUpgrade();
                this.saveToStorage();
                toastr.success('All levels reset to 0');
            }
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Import button
        document.getElementById('importBtn').addEventListener('click', () => {
            document.querySelector('.tab-btn[data-tab="import"]').click();
        });

        // Load JSON button
        document.getElementById('loadJsonBtn').addEventListener('click', () => {
            this.importFromJson();
        });

        // Load file button - fix this
        document.getElementById('loadFileBtn').addEventListener('click', () => {
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

        // Clear JSON button
        document.getElementById('clearJsonBtn').addEventListener('click', () => {
            document.getElementById('jsonInput').value = '';
        });

        // Copy JSON button
        document.getElementById('copyJsonBtn').addEventListener('click', () => {
            this.copyToClipboard();
        });

        // Save JSON button
        document.getElementById('saveJsonBtn').addEventListener('click', () => {
            this.downloadJson();
        });

        // Clear all button
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            if (confirm('Clear all data including saved progress?')) {
                localStorage.clear();
                location.reload();
            }
        });

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
                document.getElementById(`${tab}Tab`).classList.add('active');
                
                // Update export preview
                if (tab === 'export') {
                    this.updateExportPreview();
                }
            });
        });

        // Help button
        document.getElementById('helpBtn').addEventListener('click', () => {
            document.getElementById('helpModal').style.display = 'flex';
        });

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            document.getElementById('helpModal').style.display = 'none';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') {
                document.getElementById('helpModal').style.display = 'none';
            }
        });

        // Filters
        document.getElementById('filterAffordable').addEventListener('change', () => {
            this.renderTable();
        });

        document.getElementById('filterMaxLevel').addEventListener('change', () => {
            this.renderTable();
        });

        document.getElementById('searchInput').addEventListener('input', () => {
            this.renderTable();
        });

        document.getElementById('categoryFilter').addEventListener('change', () => {
            this.renderTable();
        });

        // Buy recommendation button
        document.getElementById('buyRecBtn')?.addEventListener('click', () => {
            this.buyRecommendation();
        });

        // Ignore recommendation button
        document.getElementById('ignoreRecBtn')?.addEventListener('click', () => {
            this.ignoreRecommendation();
        });
    }

    calculateCost(upgradeName, level) {
        const baseCost = this.upgrades[upgradeName].baseCost;
        return Math.floor(baseCost * Math.pow(1.15, level - 1));
    }

    calculateTotalSpent(upgradeName) {
        let total = 0;
        const currentLevel = this.levels[upgradeName];
        
        for (let level = 1; level <= currentLevel; level++) {
            total += this.calculateCost(upgradeName, level);
        }
        
        return total;
    }

    calculateDps() {
        let totalDps = 0;
        
        Object.entries(this.upgrades).forEach(([name, data]) => {
            const level = this.levels[name];
            totalDps += data.dps * level;
        });
        
        this.currentDps = totalDps;
        
        // Update UI
        document.getElementById('currentDps').textContent = totalDps.toFixed(2);
        
        return totalDps;
    }

    calculateNewDps(upgradeName) {
        let newDps = 0;
        
        Object.entries(this.upgrades).forEach(([name, data]) => {
            let level = this.levels[name];
            
            if (name === upgradeName) {
                level += 1;
            }
            
            newDps += data.dps * level;
        });
        
        return newDps;
    }

    findBestUpgrade() {
        this.availableMoney = parseInt(document.getElementById('moneyInput').value) || 0;
        
        let bestUpgrade = null;
        let bestValue = -Infinity;
        
        Object.entries(this.upgrades).forEach(([name, data]) => {
            const currentLevel = this.levels[name];
            
            // Skip if at max level
            if (currentLevel >= data.maxLevel) return;
            
            // Skip ignored recommendations
            if (this.ignoredRecommendations.has(name)) return;
            
            const nextCost = this.calculateCost(name, currentLevel + 1);
            
            // Skip if not affordable (unless we're ignoring affordability)
            if (nextCost > this.availableMoney && document.getElementById('filterAffordable').checked) {
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
        const currentLevel = this.levels[upgradeName];
        const nextCost = this.calculateCost(upgradeName, currentLevel + 1);
        const dpsIncrease = upgrade.dps;
        const dpsPerCost = upgrade.dps / nextCost;
        const affordable = nextCost <= this.availableMoney;
        
        // Update recommendation card
        if (document.getElementById('recName')) {
            document.getElementById('recName').textContent = upgradeName;
            document.getElementById('recCurrentLevel').textContent = `${currentLevel} / ${upgrade.maxLevel}`;
            document.getElementById('recNextCost').textContent = nextCost.toLocaleString();
            document.getElementById('recDpsIncrease').textContent = dpsIncrease.toFixed(4);
            document.getElementById('recDpsPerCost').textContent = dpsPerCost.toFixed(6);
            document.getElementById('recAffordable').textContent = affordable ? 'Yes' : 'No';
            document.getElementById('recAffordable').style.color = affordable ? '#27ae60' : '#e74c3c';
        }
        
        // Update DPS stats
        const newDps = this.calculateNewDps(upgradeName);
        const dpsIncreasePercent = this.currentDps > 0 ? 
            ((newDps - this.currentDps) / this.currentDps * 100).toFixed(2) : '100.00';
        
        if (document.getElementById('newDps')) {
            document.getElementById('newDps').textContent = newDps.toFixed(2);
            document.getElementById('dpsIncrease').textContent = `${dpsIncreasePercent}%`;
            document.getElementById('dpsIncrease').style.color = parseFloat(dpsIncreasePercent) > 0 ? '#27ae60' : '#e74c3c';
        }
    }

    buyRecommendation() {
        if (!this.recommendation) return;
        
        const upgradeName = this.recommendation;
        const currentLevel = this.levels[upgradeName];
        const nextCost = this.calculateCost(upgradeName, currentLevel + 1);
        
        if (nextCost > this.availableMoney) {
            toastr.error(`Not enough money! Need ${nextCost.toLocaleString()}`);
            return;
        }
        
        this.levels[upgradeName]++;
        this.availableMoney -= nextCost;
        
        // Update money input
        document.getElementById('moneyInput').value = this.availableMoney;
        
        // Recalculate
        this.calculateDps();
        this.findBestUpgrade();
        this.saveToStorage();
        
        toastr.success(`Purchased ${upgradeName} level ${currentLevel + 1} for ${nextCost.toLocaleString()}`);
    }

    ignoreRecommendation() {
        if (!this.recommendation) return;
        
        this.ignoredRecommendations.add(this.recommendation);
        this.findBestUpgrade();
        
        toastr.info(`Ignored ${this.recommendation} for this session`);
    }

    incrementLevel(upgradeName, amount = 1) {
        const currentLevel = this.levels[upgradeName];
        const maxLevel = this.upgrades[upgradeName].maxLevel;
        
        if (currentLevel >= maxLevel) {
            toastr.warning(`${upgradeName} is already at max level!`);
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
            toastr.error(`Need ${totalCost.toLocaleString()} money for ${amount} levels!`);
            return;
        }
        
        this.levels[upgradeName] = Math.min(currentLevel + amount, maxLevel);
        this.availableMoney -= totalCost;
        
        // Update UI
        document.getElementById('moneyInput').value = this.availableMoney;
        
        // Recalculate
        this.calculateDps();
        this.findBestUpgrade();
        this.saveToStorage();
        
        toastr.success(`Added ${amount} level(s) to ${upgradeName}`);
    }

    decrementLevel(upgradeName, amount = 1) {
        const currentLevel = this.levels[upgradeName];
        
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
        document.getElementById('moneyInput').value = this.availableMoney;
        
        // Recalculate
        this.calculateDps();
        this.findBestUpgrade();
        this.saveToStorage();
        
        toastr.info(`Refunded ${refund.toLocaleString()} from ${upgradeName}`);
    }

    setLevel(upgradeName, level) {
        const parsedLevel = parseInt(level);
        const maxLevel = this.upgrades[upgradeName].maxLevel;
        
        if (isNaN(parsedLevel)) return;
        
        const newLevel = Math.max(0, Math.min(parsedLevel, maxLevel));
        const currentLevel = this.levels[upgradeName];
        
        if (newLevel === currentLevel) return;
        
        if (newLevel > currentLevel) {
            // Buying levels
            let totalCost = 0;
            for (let i = currentLevel + 1; i <= newLevel; i++) {
                totalCost += this.calculateCost(upgradeName, i);
            }
            
            if (totalCost > this.availableMoney) {
                toastr.error(`Need ${totalCost.toLocaleString()} money!`);
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
        document.getElementById('moneyInput').value = this.availableMoney;
        
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
        
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
        const showOnlyAffordable = document.getElementById('filterAffordable')?.checked || false;
        const hideMaxLevel = document.getElementById('filterMaxLevel')?.checked || false;
        
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
                
                if (categoryFilter !== 'all' && data.category !== categoryFilter) {
                    return false;
                }
                
                const currentLevel = this.levels[name];
                
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
            .sort(([nameA, dataA], [nameB, dataB]) => {
                // Sort by recommendation status first, then by name
                const aRec = nameA === this.recommendation;
                const bRec = nameB === this.recommendation;
                
                if (aRec && !bRec) return -1;
                if (!aRec && bRec) return 1;
                
                return nameA.localeCompare(nameB);
            })
            .forEach(([name, data]) => {
                const currentLevel = this.levels[name];
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
                
                incrementBtn.addEventListener('click', () => this.incrementLevel(name, 1));
                decrementBtn.addEventListener('click', () => this.decrementLevel(name, 1));
                
                levelInput.addEventListener('change', (e) => this.setLevel(name, e.target.value));
                levelInput.addEventListener('blur', (e) => {
                    if (e.target.value === '') {
                        e.target.value = currentLevel;
                    }
                });
                
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
        if (document.getElementById('totalLevels')) {
            document.getElementById('totalLevels').textContent = totalLevels;
            document.getElementById('totalSpent').textContent = totalSpent.toLocaleString();
            document.getElementById('totalDps').textContent = totalDps.toFixed(2);
        }
        
        // Update current DPS
        if (document.getElementById('currentDps')) {
            document.getElementById('currentDps').textContent = totalDps.toFixed(2);
        }
        this.currentDps = totalDps;
    }

    exportData() {
        const data = {
            money: this.availableMoney,
            levels: this.levels,
            upgrades: this.upgrades,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const jsonStr = JSON.stringify(data, null, 2);
        
        // Update export preview
        if (document.getElementById('jsonOutput')) {
            document.getElementById('jsonOutput').value = jsonStr;
        }
        
        // Switch to export tab
        const exportTab = document.querySelector('.tab-btn[data-tab="export"]');
        if (exportTab) exportTab.click();
        
        toastr.success('Data exported to JSON');
    }

    updateExportPreview() {
        const data = {
            money: this.availableMoney,
            levels: this.levels,
            timestamp: new Date().toISOString()
        };
        
        if (document.getElementById('jsonOutput')) {
            document.getElementById('jsonOutput').value = JSON.stringify(data, null, 2);
        }
    }

    importFromJson() {
        const jsonInput = document.getElementById('jsonInput');
        if (!jsonInput) return;
        
        const jsonText = jsonInput.value;
        
        if (!jsonText.trim()) {
            toastr.error('Please paste JSON data first');
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
                document.getElementById('moneyInput').value = this.availableMoney;
            }
            
            // Reset ignored recommendations
            this.ignoredRecommendations.clear();
            
            // Update UI
            this.renderTable();
            this.calculateDps();
            this.findBestUpgrade();
            this.saveToStorage();
            
            toastr.success('Data imported successfully!');
            
        } catch (error) {
            toastr.error('Invalid JSON format!');
            console.error(error);
        }
    }

    async loadFromFile(file) {
        if (!file) return;
        
        try {
            const text = await file.text();
            document.getElementById('jsonInput').value = text;
            this.importFromJson();
        } catch (error) {
            toastr.error('Failed to read file');
            console.error(error);
        }
    }

    copyToClipboard() {
        const textarea = document.getElementById('jsonOutput');
        if (!textarea) return;
        
        textarea.select();
        document.execCommand('copy');
        
        toastr.success('Copied to clipboard!');
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
        
        toastr.success('File downloaded!');
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
