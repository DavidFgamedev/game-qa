class StellarDriftGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Game systems
        this.gameState = new GameState();
        this.inputManager = new InputManager();
        this.audioManager = new AudioManager();
        this.particleSystem = null;
        this.objectPool = null;
        this.collisionDetection = new CollisionDetection();
        
        // Game objects
        this.spaceship = null;
        this.environment = null;
        
        // Spawning
        this.lastAsteroidSpawn = 0;
        this.lastCrystalSpawn = 0;
        this.spawnDistance = 50; // Distance ahead of camera to spawn objects
        
        // Performance monitoring
        this.frameCount = 0;
        this.lastFPSUpdate = 0;
        this.currentFPS = 0;
        
        this.initialize();
    }
    
    async initialize() {
        try {
            this.setupRenderer();
            this.setupScene();
            this.setupCamera();
            this.setupLighting();
            
            // Initialize systems
            await this.audioManager.initialize();
            this.particleSystem = new ParticleSystem(this.scene);
            this.objectPool = new GameObjectPool(this.scene);
            
            // Create game objects
            this.spaceship = new Spaceship(this.scene);
            this.environment = new Environment(this.scene, this.camera);
            
            this.setupCollisions();
            this.setupEventListeners();
            
            // Start the game loop
            this.gameLoop();
            
            console.log('Stellar Drift initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
        }
    }
    
    setupRenderer() {
        const canvas = document.getElementById('game-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true,
            alpha: false
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Enhanced visual settings
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        // Clear color for space
        this.renderer.setClearColor(0x334466, 1);
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        
        // Add fog for depth perception (disabled for debugging)
        // this.scene.fog = new THREE.Fog(0x000022, 50, 200);
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, // FOV
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near plane
            2000 // Far plane
        );
        
        // Position camera behind and slightly above the ship
        this.camera.position.set(0, 5, -15);
        this.camera.lookAt(0, 0, 0);
    }
    
    setupLighting() {
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 4.0);
        this.scene.add(ambientLight);
        
        // Directional light (like a distant star)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
        directionalLight.position.set(100, 50, 50);
        directionalLight.castShadow = true;
        
        // Configure shadow settings
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        
        this.scene.add(directionalLight);
        
        // Point light for dramatic lighting
        const pointLight = new THREE.PointLight(0x88bbff, 3.0, 150);
        pointLight.position.set(-30, 20, 10);
        this.scene.add(pointLight);
        
        // Hemisphere light for ambient color variation
        const hemisphereLight = new THREE.HemisphereLight(0x88ccff, 0x448844, 1.5);
        this.scene.add(hemisphereLight);
        
        // DEBUG: Add a bright test cube to verify rendering
        const testGeometry = new THREE.BoxGeometry(2, 2, 2);
        const testMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const testCube = new THREE.Mesh(testGeometry, testMaterial);
        testCube.position.set(0, 2, -5);
        this.scene.add(testCube);
    }
    
    setupCollisions() {
        // We'll add collision pairs dynamically as objects spawn
        this.activeAsteroids = [];
        this.activeCrystals = [];
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        // Visibility change (pause when tab is not active)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.clock.stop();
                this.audioManager.setMasterVolume(0.2);
            } else {
                this.clock.start();
                this.audioManager.setMasterVolume(1.0);
            }
        });
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    gameLoop() {
        requestAnimationFrame(() => this.gameLoop());
        
        const deltaTime = this.clock.getDelta();
        this.update(deltaTime);
        this.render();
        
        // Update performance metrics
        this.updatePerformanceMetrics(deltaTime);
    }
    
    update(deltaTime) {
        // Limit deltaTime to prevent large jumps
        deltaTime = Math.min(deltaTime, 0.1);
        
        // Update game state
        this.gameState.update(deltaTime);
        
        if (this.gameState.isPlaying()) {
            this.updateGameplay(deltaTime);
        }
        
        // Update systems regardless of game state
        this.particleSystem.update(deltaTime);
        this.environment.update(deltaTime, this.camera.position);
    }
    
    updateGameplay(deltaTime) {
        const input = this.inputManager.getInput();
        
        // Update spaceship
        this.spaceship.update(deltaTime, input);
        
        // Update fuel UI
        this.gameState.updateFuelUI(this.spaceship.getFuelPercentage());
        
        // Check for game over conditions
        if (this.spaceship.isOutOfFuel()) {
            this.endGame();
            return;
        }
        
        // Update camera to follow ship
        this.updateCamera(deltaTime);
        
        // Spawn objects
        this.spawnObjects(deltaTime);
        
        // Update pooled objects
        this.objectPool.updatePooledObjects(deltaTime);
        
        // Update particle systems
        this.updateParticleEffects(deltaTime);
        
        // Check collisions
        this.checkCollisions();
        
        // Update audio
        this.updateAudio();
        
        // Clean up distant objects
        this.cleanupDistantObjects();
    }
    
    updateCamera(deltaTime) {
        const targetPosition = this.spaceship.position.clone();
        targetPosition.z -= 15; // Behind the ship
        targetPosition.y += 5;  // Above the ship
        
        // Smooth camera following
        const lerpFactor = 5.0 * deltaTime;
        this.camera.position.lerp(targetPosition, lerpFactor);
        
        // Look at point slightly ahead of the ship
        const lookAtTarget = this.spaceship.position.clone();
        lookAtTarget.z += 10;
        
        // Smooth look-at transition
        const currentLookAt = new THREE.Vector3();
        this.camera.getWorldDirection(currentLookAt);
        currentLookAt.multiplyScalar(10).add(this.camera.position);
        
        currentLookAt.lerp(lookAtTarget, lerpFactor);
        this.camera.lookAt(currentLookAt);
    }
    
    spawnObjects(deltaTime) {
        const currentTime = this.clock.getElapsedTime();
        const forwardSpeed = this.gameState.getCurrentSpeed();
        
        // Spawn asteroids
        if (currentTime - this.lastAsteroidSpawn > 1.0 / this.gameState.getAsteroidSpawnRate()) {
            this.spawnAsteroid();
            this.lastAsteroidSpawn = currentTime;
        }
        
        // Spawn crystals
        if (currentTime - this.lastCrystalSpawn > 1.0 / this.gameState.getCrystalSpawnRate()) {
            this.spawnCrystal();
            this.lastCrystalSpawn = currentTime;
        }
        
        // Move world forward
        this.moveWorldForward(forwardSpeed * deltaTime);
    }
    
    spawnAsteroid() {
        const spawnZ = this.camera.position.z + this.spawnDistance;
        const spawnX = (Math.random() - 0.5) * 60;
        const spawnY = (Math.random() - 0.5) * 30;
        
        const position = new THREE.Vector3(spawnX, spawnY, spawnZ);
        const size = 1 + Math.random() * 2 * this.gameState.getDifficulty();
        
        const asteroid = this.objectPool.spawnAsteroid(position, size);
        if (asteroid) {
            // Set velocity to move towards camera
            asteroid.userData.velocity.set(0, 0, -this.gameState.getCurrentSpeed());
            
            // Add some random movement
            asteroid.userData.velocity.x += (Math.random() - 0.5) * 5;
            asteroid.userData.velocity.y += (Math.random() - 0.5) * 5;
            
            this.activeAsteroids.push(asteroid);
            
            // Add collision detection
            this.collisionDetection.addCollisionPair(
                this.spaceship.mesh,
                asteroid,
                (ship, asteroidObj, collisionInfo) => this.onShipAsteroidCollision(ship, asteroidObj, collisionInfo)
            );
        }
    }
    
    spawnCrystal() {
        const spawnZ = this.camera.position.z + this.spawnDistance;
        const spawnX = (Math.random() - 0.5) * 50;
        const spawnY = (Math.random() - 0.5) * 25;
        
        const position = new THREE.Vector3(spawnX, spawnY, spawnZ);
        
        // Determine crystal type based on rarity
        let crystalType = 'standard';
        const rarity = Math.random();
        if (rarity < 0.1) {
            crystalType = 'rare';
        } else if (rarity < 0.25) {
            crystalType = 'fuel';
        }
        
        const crystal = this.objectPool.spawnCrystal(position, crystalType);
        if (crystal) {
            // Set velocity to move towards camera
            crystal.userData.velocity.set(0, 0, -this.gameState.getCurrentSpeed());
            
            this.activeCrystals.push(crystal);
            
            // Add collision detection
            this.collisionDetection.addCollisionPair(
                this.spaceship.mesh,
                crystal,
                (ship, crystalObj, collisionInfo) => this.onShipCrystalCollision(ship, crystalObj, collisionInfo)
            );
        }
    }
    
    moveWorldForward(distance) {
        // This creates the illusion of forward movement
        // In reality, we're moving objects backwards relative to the camera
        
        // Move asteroids
        this.activeAsteroids.forEach(asteroid => {
            if (asteroid.userData.active) {
                asteroid.position.z -= distance;
            }
        });
        
        // Move crystals
        this.activeCrystals.forEach(crystal => {
            if (crystal.userData.active) {
                crystal.position.z -= distance;
            }
        });
    }
    
    updateParticleEffects(deltaTime) {
        // Engine trail
        this.particleSystem.createEngineTrail(
            this.spaceship.position,
            this.spaceship.getThrottle(),
            deltaTime
        );
        
        // Starfield effect
        this.particleSystem.createStarfield(this.camera.position, deltaTime);
    }
    
    checkCollisions() {
        this.collisionDetection.checkCollisions(0.016); // Assuming 60fps
    }
    
    onShipAsteroidCollision(ship, asteroid, collisionInfo) {
        if (asteroid.userData.exploded) return;
        
        // Check if ship has shield power-up
        if (this.gameState.isPowerUpActive('shield')) {
            // Destroy asteroid instead of damaging ship
            this.destroyAsteroid(asteroid);
            return;
        }
        
        // Damage ship
        const damaged = this.spaceship.takeDamage();
        if (damaged) {
            // Destroy asteroid
            this.destroyAsteroid(asteroid);
            
            // Audio feedback
            this.audioManager.playExplosion();
            
            // Camera shake effect
            this.cameraShake(0.5, 1.0);
            
            // Haptic feedback for mobile
            this.inputManager.vibrate([100, 50, 100]);
            
            // Check if game should end
            if (this.spaceship.isOutOfFuel()) {
                this.endGame();
            }
        }
    }
    
    onShipCrystalCollision(ship, crystal, collisionInfo) {
        if (crystal.userData.collected) return;
        
        crystal.userData.collected = true;
        
        // Add score and update statistics
        this.gameState.collectCrystal(crystal.userData.crystalType);
        
        // Restore fuel based on crystal type
        let fuelRestore = 10;
        switch (crystal.userData.crystalType) {
            case 'fuel':
                fuelRestore = 30;
                break;
            case 'rare':
                fuelRestore = 20;
                break;
            default:
                fuelRestore = 10;
                break;
        }
        
        this.spaceship.addFuel(fuelRestore);
        
        // Visual and audio feedback
        this.particleSystem.createCrystalBurst(crystal.position, crystal.userData.crystalType);
        this.audioManager.playCrystalCollect(crystal.userData.crystalType);
        
        // Remove crystal
        this.scene.remove(crystal);
        this.objectPool.release(crystal);
        
        // Remove from active list
        const index = this.activeCrystals.indexOf(crystal);
        if (index !== -1) {
            this.activeCrystals.splice(index, 1);
        }
        
        // Haptic feedback for mobile
        this.inputManager.vibrate([50]);
    }
    
    destroyAsteroid(asteroid) {
        if (asteroid.userData.exploded) return;
        
        asteroid.userData.exploded = true;
        
        // Create explosion effect
        this.particleSystem.createExplosion(asteroid.position, asteroid.userData.size);
        
        // Create debris
        const debrisCount = Math.floor(asteroid.userData.size * 3);
        for (let i = 0; i < debrisCount; i++) {
            const debrisVelocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            
            this.objectPool.spawnDebris(asteroid.position, debrisVelocity);
        }
        
        // Remove asteroid
        this.scene.remove(asteroid);
        this.objectPool.release(asteroid);
        
        // Remove from active list
        const index = this.activeAsteroids.indexOf(asteroid);
        if (index !== -1) {
            this.activeAsteroids.splice(index, 1);
        }
    }
    
    updateAudio() {
        // Update engine sound based on ship throttle
        if (this.gameState.isPlaying()) {
            this.audioManager.playEngineHum();
            this.audioManager.updateEngineHum(this.spaceship.getThrottle());
            this.audioManager.startAmbientSpace();
        } else {
            this.audioManager.stopEngineHum();
            this.audioManager.stopAmbientSpace();
        }
    }
    
    cleanupDistantObjects() {
        // Remove asteroids and crystals that are too far behind the camera
        const cleanupDistance = -50;
        
        this.activeAsteroids = this.activeAsteroids.filter(asteroid => {
            if (asteroid.position.z < this.camera.position.z + cleanupDistance) {
                this.scene.remove(asteroid);
                this.objectPool.release(asteroid);
                return false;
            }
            return true;
        });
        
        this.activeCrystals = this.activeCrystals.filter(crystal => {
            if (crystal.position.z < this.camera.position.z + cleanupDistance) {
                this.scene.remove(crystal);
                this.objectPool.release(crystal);
                return false;
            }
            return true;
        });
    }
    
    cameraShake(intensity, duration) {
        const originalPosition = this.camera.position.clone();
        const shakeStart = this.clock.getElapsedTime();
        
        const shake = () => {
            const elapsed = this.clock.getElapsedTime() - shakeStart;
            if (elapsed < duration) {
                const progress = elapsed / duration;
                const currentIntensity = intensity * (1 - progress);
                
                this.camera.position.x = originalPosition.x + (Math.random() - 0.5) * currentIntensity;
                this.camera.position.y = originalPosition.y + (Math.random() - 0.5) * currentIntensity;
                
                requestAnimationFrame(shake);
            } else {
                this.camera.position.copy(originalPosition);
            }
        };
        
        shake();
    }
    
    updatePerformanceMetrics(deltaTime) {
        this.frameCount++;
        this.lastFPSUpdate += deltaTime;
        
        if (this.lastFPSUpdate >= 1.0) {
            this.currentFPS = Math.round(this.frameCount / this.lastFPSUpdate);
            this.frameCount = 0;
            this.lastFPSUpdate = 0;
            
            // Log performance if FPS drops too low
            if (this.currentFPS < 30) {
                console.warn(`Low FPS detected: ${this.currentFPS}`);
            }
        }
    }
    
    endGame() {
        this.gameState.endGame();
        this.audioManager.stopEngineHum();
        this.audioManager.stopAmbientSpace();
        
        // Final explosion at ship position
        this.particleSystem.createExplosion(this.spaceship.position, 3.0);
        this.audioManager.playExplosion();
        
        // Camera shake
        this.cameraShake(1.0, 2.0);
        
        // Strong haptic feedback
        this.inputManager.vibrate([200, 100, 200, 100, 200]);
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    cleanup() {
        // Clean up all systems
        this.audioManager.cleanup();
        this.particleSystem.cleanup();
        this.objectPool.cleanup();
        this.spaceship.cleanup();
        this.environment.cleanup();
        this.inputManager.cleanup();
        this.gameState.cleanup();
        
        // Dispose of renderer
        this.renderer.dispose();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.stellarDriftGame = new StellarDriftGame();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.stellarDriftGame) {
        window.stellarDriftGame.cleanup();
    }
});