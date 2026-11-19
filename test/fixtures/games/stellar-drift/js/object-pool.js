class ObjectPool {
    constructor() {
        this.pools = new Map();
    }
    
    createPool(name, createFunction, initialSize = 50) {
        const pool = {
            available: [],
            inUse: [],
            createFunction: createFunction,
            totalCreated: 0
        };
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            const obj = createFunction();
            obj.userData = obj.userData || {};
            obj.userData.pooled = true;
            obj.userData.poolName = name;
            pool.available.push(obj);
            pool.totalCreated++;
        }
        
        this.pools.set(name, pool);
        return pool;
    }
    
    get(poolName) {
        const pool = this.pools.get(poolName);
        if (!pool) {
            console.warn(`Pool ${poolName} does not exist`);
            return null;
        }
        
        let obj;
        if (pool.available.length > 0) {
            obj = pool.available.pop();
        } else {
            // Create new object if pool is empty
            obj = pool.createFunction();
            obj.userData = obj.userData || {};
            obj.userData.pooled = true;
            obj.userData.poolName = poolName;
            pool.totalCreated++;
        }
        
        pool.inUse.push(obj);
        obj.userData.active = true;
        
        return obj;
    }
    
    release(obj) {
        if (!obj.userData || !obj.userData.pooled) {
            console.warn('Trying to release non-pooled object');
            return;
        }
        
        const poolName = obj.userData.poolName;
        const pool = this.pools.get(poolName);
        if (!pool) {
            console.warn(`Pool ${poolName} does not exist`);
            return;
        }
        
        // Remove from inUse
        const index = pool.inUse.indexOf(obj);
        if (index !== -1) {
            pool.inUse.splice(index, 1);
        }
        
        // Reset object state
        this.resetObject(obj);
        obj.userData.active = false;
        
        // Return to available pool
        pool.available.push(obj);
    }
    
    resetObject(obj) {
        // Reset transform
        obj.position.set(0, 0, 0);
        obj.rotation.set(0, 0, 0);
        obj.scale.set(1, 1, 1);
        
        // Reset visibility
        obj.visible = false;
        
        // Reset physics properties if they exist
        if (obj.userData.velocity) {
            obj.userData.velocity.set(0, 0, 0);
        }
        
        if (obj.userData.angularVelocity) {
            obj.userData.angularVelocity.set(0, 0, 0);
        }
        
        // Reset custom properties
        obj.userData.health = obj.userData.maxHealth || 1;
        obj.userData.collected = false;
        obj.userData.exploded = false;
    }
    
    getPoolStats(poolName) {
        const pool = this.pools.get(poolName);
        if (!pool) return null;
        
        return {
            available: pool.available.length,
            inUse: pool.inUse.length,
            totalCreated: pool.totalCreated,
            utilizationRate: pool.inUse.length / pool.totalCreated
        };
    }
    
    getAllStats() {
        const stats = {};
        for (const [name, pool] of this.pools) {
            stats[name] = this.getPoolStats(name);
        }
        return stats;
    }
    
    cleanup() {
        for (const [name, pool] of this.pools) {
            // Dispose of all objects in the pool
            const allObjects = [...pool.available, ...pool.inUse];
            
            for (const obj of allObjects) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(mat => mat.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
                
                // Remove from scene if it's there
                if (obj.parent) {
                    obj.parent.remove(obj);
                }
            }
            
            pool.available = [];
            pool.inUse = [];
        }
        
        this.pools.clear();
    }
}

// Specific object creators for our game
class GameObjectPool extends ObjectPool {
    constructor(scene) {
        super();
        this.scene = scene;
        this.setupGamePools();
    }
    
    setupGamePools() {
        // Asteroid pool
        this.createPool('asteroids', () => this.createAsteroid(), 30);
        
        // Crystal pool
        this.createPool('crystals', () => this.createCrystal(), 20);
        
        // Debris pool
        this.createPool('debris', () => this.createDebris(), 40);
    }
    
    createAsteroid() {
        // Create different asteroid shapes
        const asteroidTypes = [
            () => new THREE.DodecahedronGeometry(1, 0),
            () => new THREE.IcosahedronGeometry(1, 0),
            () => new THREE.OctahedronGeometry(1, 0),
            () => {
                const geo = new THREE.SphereGeometry(1, 8, 6);
                // Deform vertices for irregular shape
                const positions = geo.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const vertex = new THREE.Vector3();
                    vertex.fromBufferAttribute(positions, i);
                    vertex.normalize().multiplyScalar(0.8 + Math.random() * 0.4);
                    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
                }
                positions.needsUpdate = true;
                geo.computeVertexNormals();
                return geo;
            }
        ];
        
        const geometryCreator = asteroidTypes[Math.floor(Math.random() * asteroidTypes.length)];
        const geometry = geometryCreator();
        
        const material = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(0.1, 0.3, 0.2 + Math.random() * 0.3),
            flatShading: true
        });
        
        const asteroid = new THREE.Mesh(geometry, material);
        
        // Add custom properties
        asteroid.userData = {
            type: 'asteroid',
            size: 1 + Math.random() * 2,
            rotationSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ),
            health: 1,
            maxHealth: 1,
            velocity: new THREE.Vector3(),
            boundingRadius: 1
        };
        
        return asteroid;
    }
    
    createCrystal() {
        const geometry = new THREE.ConeGeometry(0.3, 1, 8);
        
        const crystalTypes = ['standard', 'rare', 'fuel'];
        const crystalType = crystalTypes[Math.floor(Math.random() * crystalTypes.length)];
        
        let material;
        let points = 10;
        
        switch (crystalType) {
            case 'rare':
                material = new THREE.MeshPhongMaterial({
                    color: 0xff00ff,
                    emissive: 0x440044,
                    transparent: true,
                    opacity: 0.8
                });
                points = 50;
                break;
            case 'fuel':
                material = new THREE.MeshPhongMaterial({
                    color: 0x00ffff,
                    emissive: 0x004444,
                    transparent: true,
                    opacity: 0.8
                });
                points = 25;
                break;
            default: // standard
                material = new THREE.MeshPhongMaterial({
                    color: 0xffff00,
                    emissive: 0x444400,
                    transparent: true,
                    opacity: 0.8
                });
                points = 10;
                break;
        }
        
        const crystal = new THREE.Mesh(geometry, material);
        
        crystal.userData = {
            type: 'crystal',
            crystalType: crystalType,
            points: points,
            rotationSpeed: new THREE.Vector3(0, 2, 0),
            pulseSpeed: 2 + Math.random() * 2,
            velocity: new THREE.Vector3(),
            boundingRadius: 0.5,
            collected: false
        };
        
        return crystal;
    }
    
    createDebris() {
        const geometries = [
            new THREE.BoxGeometry(0.1, 0.1, 0.3),
            new THREE.CylinderGeometry(0.05, 0.05, 0.2),
            new THREE.TetrahedronGeometry(0.1)
        ];
        
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const material = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.4)
        });
        
        const debris = new THREE.Mesh(geometry, material);
        
        debris.userData = {
            type: 'debris',
            rotationSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            ),
            velocity: new THREE.Vector3(),
            life: 5 + Math.random() * 5,
            maxLife: 10,
            boundingRadius: 0.2
        };
        
        return debris;
    }
    
    spawnAsteroid(position, size = null) {
        const asteroid = this.get('asteroids');
        if (!asteroid) return null;
        
        asteroid.position.copy(position);
        asteroid.visible = true;
        
        const scale = size || asteroid.userData.size;
        asteroid.scale.setScalar(scale);
        asteroid.userData.boundingRadius = scale;
        
        // Random rotation
        asteroid.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        this.scene.add(asteroid);
        return asteroid;
    }
    
    spawnCrystal(position, crystalType = null) {
        const crystal = this.get('crystals');
        if (!crystal) return null;
        
        if (crystalType) {
            crystal.userData.crystalType = crystalType;
            // Update material based on type
            switch (crystalType) {
                case 'rare':
                    crystal.material.color.setHex(0xff00ff);
                    crystal.material.emissive.setHex(0x440044);
                    crystal.userData.points = 50;
                    break;
                case 'fuel':
                    crystal.material.color.setHex(0x00ffff);
                    crystal.material.emissive.setHex(0x004444);
                    crystal.userData.points = 25;
                    break;
                default:
                    crystal.material.color.setHex(0xffff00);
                    crystal.material.emissive.setHex(0x444400);
                    crystal.userData.points = 10;
                    break;
            }
        }
        
        crystal.position.copy(position);
        crystal.visible = true;
        crystal.userData.collected = false;
        
        this.scene.add(crystal);
        return crystal;
    }
    
    spawnDebris(position, velocity = null) {
        const debris = this.get('debris');
        if (!debris) return null;
        
        debris.position.copy(position);
        debris.visible = true;
        debris.userData.life = debris.userData.maxLife;
        
        if (velocity) {
            debris.userData.velocity.copy(velocity);
        } else {
            debris.userData.velocity.set(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 5
            );
        }
        
        this.scene.add(debris);
        return debris;
    }
    
    updatePooledObjects(deltaTime) {
        // Update asteroids
        const asteroidPool = this.pools.get('asteroids');
        if (asteroidPool) {
            for (const asteroid of asteroidPool.inUse) {
                if (!asteroid.userData.active) continue;
                
                // Rotate
                asteroid.rotation.x += asteroid.userData.rotationSpeed.x * deltaTime;
                asteroid.rotation.y += asteroid.userData.rotationSpeed.y * deltaTime;
                asteroid.rotation.z += asteroid.userData.rotationSpeed.z * deltaTime;
                
                // Move
                asteroid.position.add(asteroid.userData.velocity.clone().multiplyScalar(deltaTime));
                
                // Remove if too far behind camera
                if (asteroid.position.z < -50) {
                    this.scene.remove(asteroid);
                    this.release(asteroid);
                }
            }
        }
        
        // Update crystals
        const crystalPool = this.pools.get('crystals');
        if (crystalPool) {
            for (const crystal of crystalPool.inUse) {
                if (!crystal.userData.active || crystal.userData.collected) continue;
                
                // Rotate
                crystal.rotation.y += crystal.userData.rotationSpeed.y * deltaTime;
                
                // Pulse effect
                const pulse = 1 + Math.sin(Date.now() * 0.001 * crystal.userData.pulseSpeed) * 0.2;
                crystal.scale.setScalar(pulse);
                
                // Move
                crystal.position.add(crystal.userData.velocity.clone().multiplyScalar(deltaTime));
                
                // Remove if too far behind camera
                if (crystal.position.z < -50) {
                    this.scene.remove(crystal);
                    this.release(crystal);
                }
            }
        }
        
        // Update debris
        const debrisPool = this.pools.get('debris');
        if (debrisPool) {
            for (const debris of debrisPool.inUse) {
                if (!debris.userData.active) continue;
                
                debris.userData.life -= deltaTime;
                if (debris.userData.life <= 0) {
                    this.scene.remove(debris);
                    this.release(debris);
                    continue;
                }
                
                // Rotate
                debris.rotation.x += debris.userData.rotationSpeed.x * deltaTime;
                debris.rotation.y += debris.userData.rotationSpeed.y * deltaTime;
                debris.rotation.z += debris.userData.rotationSpeed.z * deltaTime;
                
                // Move with gravity
                debris.userData.velocity.y -= 9.8 * deltaTime;
                debris.position.add(debris.userData.velocity.clone().multiplyScalar(deltaTime));
                
                // Fade out over time
                const lifeRatio = debris.userData.life / debris.userData.maxLife;
                debris.material.opacity = lifeRatio;
                
                // Remove if too far behind camera or faded out
                if (debris.position.z < -50 || lifeRatio <= 0) {
                    this.scene.remove(debris);
                    this.release(debris);
                }
            }
        }
    }
}