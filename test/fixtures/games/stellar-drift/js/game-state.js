class GameState {
    constructor() {
        this.currentState = 'MENU';
        this.previousState = null;
        
        // Game statistics
        this.score = 0;
        this.crystalsCollected = 0;
        this.distanceTraveled = 0;
        this.gameTime = 0;
        this.highScore = this.loadHighScore();
        
        // Game progression
        this.speed = 20; // Base forward speed
        this.baseSpeed = 20;
        this.maxSpeed = 50;
        this.speedIncrement = 0.5; // Speed increase per second
        this.difficulty = 1.0;
        
        // Spawning rates
        this.asteroidSpawnRate = 2.0; // per second
        this.crystalSpawnRate = 1.0; // per second
        
        // Power-ups and special events
        this.powerUps = {
            shield: { active: false, duration: 0, maxDuration: 10 },
            speedBoost: { active: false, duration: 0, maxDuration: 5 },
            magneticField: { active: false, duration: 0, maxDuration: 8 }
        };
        
        // Achievement tracking
        this.achievements = {
            firstCrystal: false,
            speedDemon: false, // Reach max speed
            survivor: false, // Survive 5 minutes
            collector: false, // Collect 100 crystals in one game
            distance: false // Travel 10km
        };
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // UI Button handlers
        document.getElementById('start-button')?.addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('restart-button')?.addEventListener('click', () => {
            this.startGame();
        });
    }
    
    setState(newState) {
        this.previousState = this.currentState;
        this.currentState = newState;
        this.updateUI();
    }
    
    updateUI() {
        // Hide all UI screens
        const screens = ['start-menu', 'game-over', 'loading', 'hud'];
        screens.forEach(screen => {
            const element = document.getElementById(screen);
            if (element) {
                element.classList.add('hidden');
            }
        });
        
        // Show current state UI
        switch (this.currentState) {
            case 'MENU':
                document.getElementById('start-menu')?.classList.remove('hidden');
                break;
            case 'LOADING':
                document.getElementById('loading')?.classList.remove('hidden');
                break;
            case 'PLAYING':
                document.getElementById('hud')?.classList.remove('hidden');
                break;
            case 'GAME_OVER':
                document.getElementById('game-over')?.classList.remove('hidden');
                this.updateGameOverUI();
                break;
        }
    }
    
    startGame() {
        this.setState('LOADING');
        
        // Simulate loading time
        setTimeout(() => {
            this.resetGameStats();
            this.setState('PLAYING');
        }, 1000);
    }
    
    resetGameStats() {
        this.score = 0;
        this.crystalsCollected = 0;
        this.distanceTraveled = 0;
        this.gameTime = 0;
        this.speed = this.baseSpeed;
        this.difficulty = 1.0;
        
        // Reset power-ups
        for (const powerUp of Object.values(this.powerUps)) {
            powerUp.active = false;
            powerUp.duration = 0;
        }
        
        // Reset achievements for this game
        this.achievements.firstCrystal = false;
        this.achievements.speedDemon = false;
        this.achievements.survivor = false;
        this.achievements.collector = false;
        this.achievements.distance = false;
    }
    
    endGame() {
        this.setState('GAME_OVER');
        
        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
        
        // Check achievements
        this.checkAchievements();
    }
    
    update(deltaTime) {
        if (this.currentState !== 'PLAYING') return;
        
        this.gameTime += deltaTime;
        
        // Increase speed over time
        this.speed = Math.min(this.maxSpeed, this.baseSpeed + (this.gameTime * this.speedIncrement));
        
        // Update distance traveled
        this.distanceTraveled += this.speed * deltaTime;
        
        // Update difficulty based on time and score
        this.difficulty = 1.0 + (this.gameTime / 60) + (this.score / 1000);
        
        // Update spawn rates based on difficulty
        this.asteroidSpawnRate = 2.0 + (this.difficulty * 0.5);
        this.crystalSpawnRate = 1.0 + (this.difficulty * 0.2);
        
        // Update power-ups
        this.updatePowerUps(deltaTime);
        
        // Update UI
        this.updateGameUI();
    }
    
    updatePowerUps(deltaTime) {
        for (const [name, powerUp] of Object.entries(this.powerUps)) {
            if (powerUp.active) {
                powerUp.duration -= deltaTime;
                if (powerUp.duration <= 0) {
                    powerUp.active = false;
                    powerUp.duration = 0;
                    this.onPowerUpExpired(name);
                }
            }
        }
    }
    
    updateGameUI() {
        // Update score
        document.getElementById('score-value').textContent = this.score;
        
        // Update speed
        const speedMultiplier = (this.speed / this.baseSpeed).toFixed(1);
        document.getElementById('speed-value').textContent = speedMultiplier + 'x';
        
        // Fuel is updated in the main game loop by the spaceship
    }
    
    updateGameOverUI() {
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('crystals-collected').textContent = this.crystalsCollected;
        document.getElementById('distance-traveled').textContent = Math.floor(this.distanceTraveled);
    }
    
    updateFuelUI(fuelPercentage) {
        const fuelFill = document.getElementById('fuel-fill');
        if (fuelFill) {
            fuelFill.style.width = (fuelPercentage * 100) + '%';
            
            // Change color based on fuel level
            if (fuelPercentage > 0.6) {
                fuelFill.style.background = 'linear-gradient(90deg, #00ff00 0%, #ffff00 100%)';
            } else if (fuelPercentage > 0.3) {
                fuelFill.style.background = 'linear-gradient(90deg, #ffff00 0%, #ff8800 100%)';
            } else {
                fuelFill.style.background = 'linear-gradient(90deg, #ff0000 0%, #ff4400 100%)';
            }
        }
    }
    
    addScore(points) {
        this.score += points;
        
        // Bonus for combo scoring
        if (points > 10) {
            this.createScorePopup(points);
        }
    }
    
    collectCrystal(crystalType) {
        this.crystalsCollected++;
        
        let points = 10;
        switch (crystalType) {
            case 'rare':
                points = 50;
                break;
            case 'fuel':
                points = 25;
                break;
            default:
                points = 10;
                break;
        }
        
        this.addScore(points);
        
        // First crystal achievement
        if (!this.achievements.firstCrystal) {
            this.achievements.firstCrystal = true;
            this.showAchievement('First Crystal!');
        }
    }
    
    activatePowerUp(type, duration = null) {
        if (!this.powerUps[type]) return;
        
        this.powerUps[type].active = true;
        this.powerUps[type].duration = duration || this.powerUps[type].maxDuration;
        
        this.onPowerUpActivated(type);
    }
    
    onPowerUpActivated(type) {
        switch (type) {
            case 'shield':
                this.showPowerUpNotification('Shield Active!');
                break;
            case 'speedBoost':
                this.speed *= 1.5;
                this.showPowerUpNotification('Speed Boost!');
                break;
            case 'magneticField':
                this.showPowerUpNotification('Magnetic Field!');
                break;
        }
    }
    
    onPowerUpExpired(type) {
        switch (type) {
            case 'speedBoost':
                this.speed = Math.min(this.maxSpeed, this.baseSpeed + (this.gameTime * this.speedIncrement));
                break;
        }
    }
    
    isPowerUpActive(type) {
        return this.powerUps[type]?.active || false;
    }
    
    checkAchievements() {
        // Speed demon achievement
        if (this.speed >= this.maxSpeed && !this.achievements.speedDemon) {
            this.achievements.speedDemon = true;
            this.showAchievement('Speed Demon!');
        }
        
        // Survivor achievement
        if (this.gameTime >= 300 && !this.achievements.survivor) { // 5 minutes
            this.achievements.survivor = true;
            this.showAchievement('Survivor!');
        }
        
        // Collector achievement
        if (this.crystalsCollected >= 100 && !this.achievements.collector) {
            this.achievements.collector = true;
            this.showAchievement('Crystal Collector!');
        }
        
        // Distance achievement
        if (this.distanceTraveled >= 10000 && !this.achievements.distance) { // 10km
            this.achievements.distance = true;
            this.showAchievement('Deep Space Explorer!');
        }
    }
    
    createScorePopup(points) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = '+' + points;
        popup.style.cssText = `
            position: absolute;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            color: #ffff00;
            font-size: 24px;
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            animation: scorePopup 2s ease-out forwards;
        `;
        
        // Add animation keyframes if not already present
        if (!document.getElementById('score-popup-style')) {
            const style = document.createElement('style');
            style.id = 'score-popup-style';
            style.textContent = `
                @keyframes scorePopup {
                    0% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-50px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            document.body.removeChild(popup);
        }, 2000);
    }
    
    showAchievement(text) {
        const achievement = document.createElement('div');
        achievement.className = 'achievement-popup';
        achievement.textContent = text;
        achievement.style.cssText = `
            position: absolute;
            top: 150px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 215, 0, 0.9);
            color: #000;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            animation: achievementPopup 3s ease-out forwards;
        `;
        
        // Add animation keyframes if not already present
        if (!document.getElementById('achievement-popup-style')) {
            const style = document.createElement('style');
            style.id = 'achievement-popup-style';
            style.textContent = `
                @keyframes achievementPopup {
                    0% { opacity: 0; transform: translateX(-50%) scale(0.5); }
                    10% { opacity: 1; transform: translateX(-50%) scale(1.1); }
                    20% { transform: translateX(-50%) scale(1); }
                    90% { opacity: 1; transform: translateX(-50%) scale(1); }
                    100% { opacity: 0; transform: translateX(-50%) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(achievement);
        
        setTimeout(() => {
            document.body.removeChild(achievement);
        }, 3000);
    }
    
    showPowerUpNotification(text) {
        // Similar to achievement popup but different color
        const notification = document.createElement('div');
        notification.textContent = text;
        notification.style.cssText = `
            position: absolute;
            top: 200px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 255, 255, 0.9);
            color: #000;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            animation: achievementPopup 2s ease-out forwards;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }
    
    loadHighScore() {
        try {
            return parseInt(localStorage.getItem('stellarDriftHighScore')) || 0;
        } catch (e) {
            return 0;
        }
    }
    
    saveHighScore() {
        try {
            localStorage.setItem('stellarDriftHighScore', this.highScore.toString());
        } catch (e) {
            console.warn('Could not save high score');
        }
    }
    
    // Getters for easy access
    isPlaying() {
        return this.currentState === 'PLAYING';
    }
    
    isGameOver() {
        return this.currentState === 'GAME_OVER';
    }
    
    isMenu() {
        return this.currentState === 'MENU';
    }
    
    getCurrentSpeed() {
        return this.speed;
    }
    
    getDifficulty() {
        return this.difficulty;
    }
    
    getAsteroidSpawnRate() {
        return this.asteroidSpawnRate;
    }
    
    getCrystalSpawnRate() {
        return this.crystalSpawnRate;
    }
    
    cleanup() {
        // Clean up any timers or intervals if needed
    }
}