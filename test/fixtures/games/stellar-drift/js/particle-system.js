class ParticleSystem {
    constructor(scene, maxParticles = 1000) {
        this.scene = scene;
        this.maxParticles = maxParticles;
        this.particles = [];
        this.particlePool = [];
        this.systems = new Map();
        
        // Initialize particle pool
        for (let i = 0; i < maxParticles; i++) {
            this.particlePool.push(this.createParticle());
        }
        
        this.setupParticleSystems();
    }
    
    createParticle() {
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([0, 0, 0]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.1,
            transparent: true,
            opacity: 1.0,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });
        
        const particle = new THREE.Points(geometry, material);
        particle.userData = {
            velocity: new THREE.Vector3(),
            life: 0,
            maxLife: 1,
            active: false,
            startSize: 0.1,
            endSize: 0.05,
            startColor: new THREE.Color(1, 1, 1),
            endColor: new THREE.Color(0.5, 0.5, 0.5)
        };
        
        return particle;
    }
    
    setupParticleSystems() {
        // Engine thrust system
        this.systems.set('engineThrust', {
            emissionRate: 50,
            particleLife: 1.5,
            startSize: 0.3,
            endSize: 0.1,
            startColor: new THREE.Color(0.2, 0.8, 1.0),
            endColor: new THREE.Color(0, 0, 0.5),
            velocity: new THREE.Vector3(0, 0, -15),
            spread: 0.5,
            gravity: new THREE.Vector3(0, -2, 0)
        });
        
        // Crystal collection effect
        this.systems.set('crystalCollect', {
            emissionRate: 20,
            particleLife: 0.8,
            startSize: 0.2,
            endSize: 0.05,
            startColor: new THREE.Color(1, 1, 0),
            endColor: new THREE.Color(1, 0.5, 0),
            velocity: new THREE.Vector3(0, 5, 0),
            spread: 3.0,
            gravity: new THREE.Vector3(0, -10, 0)
        });
        
        // Explosion effect
        this.systems.set('explosion', {
            emissionRate: 100,
            particleLife: 2.0,
            startSize: 0.4,
            endSize: 0.1,
            startColor: new THREE.Color(1, 0.5, 0),
            endColor: new THREE.Color(0.5, 0, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            spread: 10.0,
            gravity: new THREE.Vector3(0, -5, 0)
        });
        
        // Starfield particles
        this.systems.set('starfield', {
            emissionRate: 30,
            particleLife: 10.0,
            startSize: 0.1,
            endSize: 0.05,
            startColor: new THREE.Color(1, 1, 1),
            endColor: new THREE.Color(0.8, 0.8, 1),
            velocity: new THREE.Vector3(0, 0, -20),
            spread: 0.1,
            gravity: new THREE.Vector3(0, 0, 0)
        });
    }
    
    getParticle() {
        if (this.particlePool.length > 0) {
            return this.particlePool.pop();
        }
        
        // Find inactive particle to reuse
        for (let particle of this.particles) {
            if (!particle.userData.active) {
                return particle;
            }
        }
        
        return null;
    }
    
    returnParticle(particle) {
        particle.userData.active = false;
        particle.visible = false;
        this.scene.remove(particle);
        
        if (this.particlePool.length < this.maxParticles) {
            this.particlePool.push(particle);
        }
    }
    
    emit(systemName, position, count = 1, customParams = {}) {
        const system = this.systems.get(systemName);
        if (!system) return;
        
        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) continue;
            
            // Set position
            particle.position.copy(position);
            
            // Set velocity with spread
            const velocity = system.velocity.clone();
            velocity.x += (Math.random() - 0.5) * system.spread;
            velocity.y += (Math.random() - 0.5) * system.spread;
            velocity.z += (Math.random() - 0.5) * system.spread;
            
            // Apply custom velocity if provided
            if (customParams.velocity) {
                velocity.add(customParams.velocity);
            }
            
            // Initialize particle data
            particle.userData.velocity.copy(velocity);
            particle.userData.life = 0;
            particle.userData.maxLife = system.particleLife * (0.8 + Math.random() * 0.4);
            particle.userData.active = true;
            particle.userData.startSize = customParams.startSize || system.startSize;
            particle.userData.endSize = customParams.endSize || system.endSize;
            particle.userData.startColor = customParams.startColor || system.startColor.clone();
            particle.userData.endColor = customParams.endColor || system.endColor.clone();
            particle.userData.gravity = system.gravity.clone();
            
            // Set initial appearance
            particle.material.size = particle.userData.startSize;
            particle.material.color = particle.userData.startColor.clone();
            particle.material.opacity = 1.0;
            particle.visible = true;
            
            this.scene.add(particle);
            this.particles.push(particle);
        }
    }
    
    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            if (!particle.userData.active) {
                this.particles.splice(i, 1);
                continue;
            }
            
            const userData = particle.userData;
            userData.life += deltaTime;
            
            // Check if particle should die
            if (userData.life >= userData.maxLife) {
                this.returnParticle(particle);
                this.particles.splice(i, 1);
                continue;
            }
            
            // Update position
            userData.velocity.add(userData.gravity.clone().multiplyScalar(deltaTime));
            particle.position.add(userData.velocity.clone().multiplyScalar(deltaTime));
            
            // Update appearance based on life
            const lifeRatio = userData.life / userData.maxLife;
            
            // Size interpolation
            const size = userData.startSize + (userData.endSize - userData.startSize) * lifeRatio;
            particle.material.size = size;
            
            // Color interpolation
            const color = userData.startColor.clone().lerp(userData.endColor, lifeRatio);
            particle.material.color = color;
            
            // Opacity fade
            const opacity = 1.0 - (lifeRatio * lifeRatio); // Quadratic fade
            particle.material.opacity = Math.max(0, opacity);
        }
    }
    
    // Continuous emission for engine thrust
    updateContinuousEmission(systemName, position, deltaTime, emissionMultiplier = 1.0) {
        const system = this.systems.get(systemName);
        if (!system) return;
        
        const particlesToEmit = Math.floor(system.emissionRate * deltaTime * emissionMultiplier);
        if (particlesToEmit > 0) {
            this.emit(systemName, position, particlesToEmit);
        }
    }
    
    // Burst emission for effects
    burst(systemName, position, count, customParams = {}) {
        this.emit(systemName, position, count, customParams);
    }
    
    // Special effect methods
    createEngineTrail(shipPosition, throttle = 1.0, deltaTime) {
        const trailPosition = shipPosition.clone();
        trailPosition.z -= 2; // Behind the ship
        
        this.updateContinuousEmission('engineThrust', trailPosition, deltaTime, throttle);
    }
    
    createCrystalBurst(position, crystalType = 'standard') {
        const colors = {
            'standard': { start: new THREE.Color(1, 1, 0), end: new THREE.Color(1, 0.5, 0) },
            'rare': { start: new THREE.Color(1, 0, 1), end: new THREE.Color(0.5, 0, 1) },
            'fuel': { start: new THREE.Color(0, 1, 1), end: new THREE.Color(0, 0.5, 1) }
        };
        
        const colorScheme = colors[crystalType] || colors['standard'];
        
        this.burst('crystalCollect', position, 15, {
            startColor: colorScheme.start,
            endColor: colorScheme.end
        });
    }
    
    createExplosion(position, intensity = 1.0) {
        const particleCount = Math.floor(50 * intensity);
        
        this.burst('explosion', position, particleCount, {
            startSize: 0.4 * intensity,
            endSize: 0.1 * intensity
        });
        
        // Add some additional debris particles
        for (let i = 0; i < 10; i++) {
            const debrisVelocity = new THREE.Vector3(
                (Math.random() - 0.5) * 20 * intensity,
                (Math.random() - 0.5) * 20 * intensity,
                (Math.random() - 0.5) * 20 * intensity
            );
            
            this.emit('explosion', position, 1, {
                velocity: debrisVelocity,
                startSize: 0.2 * intensity,
                endSize: 0.05 * intensity,
                startColor: new THREE.Color(1, 0.8, 0.5),
                endColor: new THREE.Color(0.2, 0.1, 0)
            });
        }
    }
    
    createStarfield(cameraPosition, deltaTime) {
        // Create stars that move past the camera
        const starPosition = new THREE.Vector3(
            cameraPosition.x + (Math.random() - 0.5) * 200,
            cameraPosition.y + (Math.random() - 0.5) * 100,
            cameraPosition.z + 50
        );
        
        this.updateContinuousEmission('starfield', starPosition, deltaTime, 0.3);
    }
    
    cleanup() {
        // Remove all particles from scene
        for (let particle of this.particles) {
            this.scene.remove(particle);
        }
        
        for (let particle of this.particlePool) {
            if (particle.geometry) particle.geometry.dispose();
            if (particle.material) particle.material.dispose();
        }
        
        this.particles = [];
        this.particlePool = [];
    }
}