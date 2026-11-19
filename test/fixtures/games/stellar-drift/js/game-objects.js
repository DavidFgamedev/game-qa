class Spaceship {
    constructor(scene) {
        this.scene = scene;
        this.mesh = this.createShipMesh();
        this.position = this.mesh.position;
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        
        // Ship properties
        this.maxSpeed = 15;
        this.acceleration_rate = 30;
        this.drag = 8;
        this.fuel = 100;
        this.maxFuel = 100;
        this.fuelConsumption = 8; // fuel per second
        
        // Movement bounds
        this.bounds = {
            x: 25,
            y: 15,
            z: 5
        };
        
        // Ship state
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        
        scene.add(this.mesh);
        this.setupLights();
    }
    
    createShipMesh() {
        const group = new THREE.Group();
        
        // Main hull
        const hullGeometry = new THREE.ConeGeometry(0.5, 3, 8);
        const hullMaterial = new THREE.MeshPhongMaterial({
            color: 0x6688dd,
            shininess: 100
        });
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        hull.rotation.x = Math.PI / 2;
        group.add(hull);
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(3, 0.1, 1);
        const wingMaterial = new THREE.MeshPhongMaterial({
            color: 0x88aaff,
            shininess: 80
        });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-1, 0, -0.5);
        leftWing.rotation.z = -0.3;
        group.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(1, 0, -0.5);
        rightWing.rotation.z = 0.3;
        group.add(rightWing);
        
        // Engine nacelles
        const engineGeometry = new THREE.CylinderGeometry(0.2, 0.15, 1.5);
        const engineMaterial = new THREE.MeshPhongMaterial({
            color: 0x5555aa,
            emissive: 0x003355
        });
        
        const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        leftEngine.position.set(-1.2, 0, -1);
        leftEngine.rotation.x = Math.PI / 2;
        group.add(leftEngine);
        
        const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        rightEngine.position.set(1.2, 0, -1);
        rightEngine.rotation.x = Math.PI / 2;
        group.add(rightEngine);
        
        // Engine glow effects
        const glowGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x33ccff,
            transparent: true,
            opacity: 0.6
        });
        
        const leftGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        leftGlow.position.set(-1.2, 0, -1.8);
        group.add(leftGlow);
        
        const rightGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        rightGlow.position.set(1.2, 0, -1.8);
        group.add(rightGlow);
        
        // Cockpit
        const cockpitGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const cockpitMaterial = new THREE.MeshPhongMaterial({
            color: 0x223355,
            transparent: true,
            opacity: 0.8,
            shininess: 200
        });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.set(0, 0, 1);
        cockpit.scale.set(1, 0.6, 0.8);
        group.add(cockpit);
        
        // Add collision bounds
        group.userData = {
            type: 'spaceship',
            boundingRadius: 2,
            active: true
        };
        
        // Store references for animations
        group.userData.engineGlows = [leftGlow, rightGlow];
        group.userData.engines = [leftEngine, rightEngine];
        
        return group;
    }
    
    setupLights() {
        // Ship headlight
        const headlight = new THREE.SpotLight(0xffffff, 0.5, 50, Math.PI / 6, 0.5);
        headlight.position.set(0, 0, 2);
        headlight.target.position.set(0, 0, 20);
        this.mesh.add(headlight);
        this.mesh.add(headlight.target);
        
        // Engine lights
        const leftEngineLight = new THREE.PointLight(0x00aaff, 0.8, 10);
        leftEngineLight.position.set(-1.2, 0, -2);
        this.mesh.add(leftEngineLight);
        
        const rightEngineLight = new THREE.PointLight(0x00aaff, 0.8, 10);
        rightEngineLight.position.set(1.2, 0, -2);
        this.mesh.add(rightEngineLight);
        
        this.lights = {
            headlight: headlight,
            leftEngine: leftEngineLight,
            rightEngine: rightEngineLight
        };
    }
    
    update(deltaTime, input) {
        // Handle invulnerability
        if (this.invulnerable) {
            this.invulnerabilityTime -= deltaTime;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
                this.mesh.visible = true;
            } else {
                // Flashing effect
                this.mesh.visible = Math.floor(Date.now() * 0.01) % 2 === 0;
            }
        }
        
        // Apply input acceleration
        this.acceleration.set(0, 0, 0);
        
        if (input.left) this.acceleration.x -= this.acceleration_rate;
        if (input.right) this.acceleration.x += this.acceleration_rate;
        if (input.up) this.acceleration.y += this.acceleration_rate;
        if (input.down) this.acceleration.y -= this.acceleration_rate;
        if (input.forward) this.acceleration.z += this.acceleration_rate * 0.5;
        if (input.backward) this.acceleration.z -= this.acceleration_rate * 0.5;
        
        // Update velocity
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
        
        // Apply drag
        const dragForce = this.velocity.clone().multiplyScalar(-this.drag);
        this.velocity.add(dragForce.multiplyScalar(deltaTime));
        
        // Limit speed
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }
        
        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Apply bounds
        this.position.x = Math.max(-this.bounds.x, Math.min(this.bounds.x, this.position.x));
        this.position.y = Math.max(-this.bounds.y, Math.min(this.bounds.y, this.position.y));
        this.position.z = Math.max(-this.bounds.z, Math.min(this.bounds.z, this.position.z));
        
        // Ship tilting based on movement
        const tiltAmount = 0.3;
        this.mesh.rotation.z = -this.velocity.x * tiltAmount * 0.1;
        this.mesh.rotation.x = this.velocity.y * tiltAmount * 0.1;
        
        // Engine glow animation
        const throttle = this.velocity.length() / this.maxSpeed;
        this.updateEngineEffects(throttle);
        
        // Consume fuel
        if (this.fuel > 0) {
            this.fuel -= this.fuelConsumption * deltaTime;
            this.fuel = Math.max(0, this.fuel);
        }
    }
    
    updateEngineEffects(throttle) {
        const glowIntensity = 0.3 + throttle * 0.7;
        const glowScale = 0.8 + throttle * 0.4 + Math.sin(Date.now() * 0.01) * 0.1;
        
        if (this.mesh.userData.engineGlows) {
            this.mesh.userData.engineGlows.forEach(glow => {
                glow.material.opacity = glowIntensity;
                glow.scale.setScalar(glowScale);
            });
        }
        
        // Update engine lights
        if (this.lights) {
            this.lights.leftEngine.intensity = 0.5 + throttle * 0.5;
            this.lights.rightEngine.intensity = 0.5 + throttle * 0.5;
        }
    }
    
    addFuel(amount) {
        this.fuel = Math.min(this.maxFuel, this.fuel + amount);
    }
    
    takeDamage() {
        if (this.invulnerable) return false;
        
        this.makeInvulnerable(2.0); // 2 seconds of invulnerability
        this.fuel -= 20; // Lose fuel on collision
        return true;
    }
    
    makeInvulnerable(duration) {
        this.invulnerable = true;
        this.invulnerabilityTime = duration;
    }
    
    getThrottle() {
        return this.velocity.length() / this.maxSpeed;
    }
    
    getFuelPercentage() {
        return this.fuel / this.maxFuel;
    }
    
    isOutOfFuel() {
        return this.fuel <= 0;
    }
    
    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
    }
}

class Environment {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.starfield = [];
        this.nebulae = [];
        this.planets = [];
        
        this.createStarfield();
        this.createNebulae();
        this.createDistantPlanets();
    }
    
    createStarfield() {
        const starCount = 2000;
        const starGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            
            // Random positions in a large sphere around the origin
            const radius = 500 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Vary star colors (blue-white to yellow-white to red)
            const temp = Math.random();
            if (temp < 0.3) {
                // Blue-white stars
                colors[i3] = 0.8 + Math.random() * 0.2;
                colors[i3 + 1] = 0.9 + Math.random() * 0.1;
                colors[i3 + 2] = 1.0;
            } else if (temp < 0.7) {
                // Yellow-white stars
                colors[i3] = 1.0;
                colors[i3 + 1] = 1.0;
                colors[i3 + 2] = 0.8 + Math.random() * 0.2;
            } else {
                // Red stars
                colors[i3] = 1.0;
                colors[i3 + 1] = 0.3 + Math.random() * 0.4;
                colors[i3 + 2] = 0.1 + Math.random() * 0.3;
            }
            
            sizes[i] = Math.random() * 3 + 1;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const starMaterial = new THREE.PointsMaterial({
            size: 2,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });
        
        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
        this.starfield = stars;
    }
    
    createNebulae() {
        const nebulaCount = 5;
        
        for (let i = 0; i < nebulaCount; i++) {
            const geometry = new THREE.PlaneGeometry(200, 100);
            
            // Create nebula texture using canvas
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            // Create gradient
            const gradient = ctx.createRadialGradient(128, 64, 0, 128, 64, 128);
            const colors = [
                ['rgba(100, 50, 200, 0.8)', 'rgba(50, 100, 255, 0.4)', 'rgba(0, 0, 0, 0)'],
                ['rgba(200, 50, 100, 0.8)', 'rgba(255, 100, 50, 0.4)', 'rgba(0, 0, 0, 0)'],
                ['rgba(50, 200, 100, 0.8)', 'rgba(100, 255, 50, 0.4)', 'rgba(0, 0, 0, 0)']
            ];
            
            const colorSet = colors[Math.floor(Math.random() * colors.length)];
            gradient.addColorStop(0, colorSet[0]);
            gradient.addColorStop(0.5, colorSet[1]);
            gradient.addColorStop(1, colorSet[2]);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 128);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });
            
            const nebula = new THREE.Mesh(geometry, material);
            
            // Position nebulae far away
            const angle = (i / nebulaCount) * Math.PI * 2;
            nebula.position.set(
                Math.cos(angle) * 800,
                (Math.random() - 0.5) * 200,
                Math.sin(angle) * 800
            );
            
            nebula.lookAt(0, 0, 0);
            
            this.scene.add(nebula);
            this.nebulae.push(nebula);
        }
    }
    
    createDistantPlanets() {
        const planetCount = 3;
        
        for (let i = 0; i < planetCount; i++) {
            const radius = 20 + Math.random() * 30;
            const geometry = new THREE.SphereGeometry(radius, 32, 32);
            
            // Create planet texture
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Base color
            const planetTypes = [
                { base: '#4a4a6a', accent: '#6a6a8a' }, // Rocky
                { base: '#2a4a8a', accent: '#4a6aaa' }, // Ocean
                { base: '#8a4a2a', accent: '#aa6a4a' }  // Desert
            ];
            
            const planetType = planetTypes[Math.floor(Math.random() * planetTypes.length)];
            
            // Fill base color
            ctx.fillStyle = planetType.base;
            ctx.fillRect(0, 0, 256, 256);
            
            // Add some surface features
            ctx.fillStyle = planetType.accent;
            for (let j = 0; j < 10; j++) {
                const x = Math.random() * 256;
                const y = Math.random() * 256;
                const size = Math.random() * 50 + 10;
                
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.MeshPhongMaterial({
                map: texture,
                shininess: 30
            });
            
            const planet = new THREE.Mesh(geometry, material);
            
            // Position planets very far away
            const distance = 1500 + Math.random() * 1000;
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 500;
            
            planet.position.set(
                Math.cos(angle) * distance,
                height,
                Math.sin(angle) * distance
            );
            
            // Add slow rotation
            planet.userData.rotationSpeed = (Math.random() - 0.5) * 0.5;
            
            this.scene.add(planet);
            this.planets.push(planet);
        }
    }
    
    update(deltaTime, cameraPosition) {
        // Rotate planets
        this.planets.forEach(planet => {
            planet.rotation.y += planet.userData.rotationSpeed * deltaTime;
        });
        
        // Subtle nebula animation
        this.nebulae.forEach((nebula, index) => {
            nebula.material.opacity = 0.4 + Math.sin(Date.now() * 0.001 + index) * 0.2;
        });
        
        // Make starfield follow camera (distant objects effect)
        if (this.starfield) {
            this.starfield.position.copy(cameraPosition);
        }
    }
    
    cleanup() {
        // Clean up starfield
        if (this.starfield) {
            this.scene.remove(this.starfield);
            this.starfield.geometry.dispose();
            this.starfield.material.dispose();
        }
        
        // Clean up nebulae
        this.nebulae.forEach(nebula => {
            this.scene.remove(nebula);
            nebula.geometry.dispose();
            nebula.material.dispose();
        });
        
        // Clean up planets
        this.planets.forEach(planet => {
            this.scene.remove(planet);
            planet.geometry.dispose();
            planet.material.dispose();
        });
    }
}