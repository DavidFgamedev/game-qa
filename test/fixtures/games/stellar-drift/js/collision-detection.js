class CollisionDetection {
    constructor() {
        this.collisionPairs = [];
        this.spatialGrid = new SpatialGrid(10); // 10x10 grid cells
        this.debugMode = false;
    }
    
    // Bounding sphere collision detection
    sphereToSphere(obj1, obj2) {
        const pos1 = obj1.position;
        const pos2 = obj2.position;
        const radius1 = obj1.userData.boundingRadius || 1;
        const radius2 = obj2.userData.boundingRadius || 1;
        
        const distance = pos1.distanceTo(pos2);
        const minDistance = radius1 + radius2;
        
        return distance < minDistance;
    }
    
    // Enhanced sphere collision with penetration info
    sphereToSphereDetailed(obj1, obj2) {
        const pos1 = obj1.position;
        const pos2 = obj2.position;
        const radius1 = obj1.userData.boundingRadius || 1;
        const radius2 = obj2.userData.boundingRadius || 1;
        
        const direction = new THREE.Vector3().subVectors(pos2, pos1);
        const distance = direction.length();
        const minDistance = radius1 + radius2;
        
        if (distance < minDistance) {
            direction.normalize();
            return {
                colliding: true,
                distance: distance,
                penetration: minDistance - distance,
                normal: direction,
                contactPoint: pos1.clone().add(direction.multiplyScalar(radius1))
            };
        }
        
        return { colliding: false };
    }
    
    // Point in sphere collision (for precise crystal collection)
    pointInSphere(point, sphere) {
        const distance = point.distanceTo(sphere.position);
        const radius = sphere.userData.boundingRadius || 1;
        return distance <= radius;
    }
    
    // Ray-sphere intersection (for projectiles or line-of-sight)
    rayToSphere(rayOrigin, rayDirection, sphere) {
        const radius = sphere.userData.boundingRadius || 1;
        const oc = rayOrigin.clone().sub(sphere.position);
        
        const a = rayDirection.lengthSq();
        const b = 2.0 * oc.dot(rayDirection);
        const c = oc.lengthSq() - radius * radius;
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) {
            return null; // No intersection
        }
        
        const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
        
        const t = Math.min(t1, t2);
        if (t > 0) {
            const hitPoint = rayOrigin.clone().add(rayDirection.clone().multiplyScalar(t));
            return {
                hit: true,
                distance: t,
                point: hitPoint,
                normal: hitPoint.clone().sub(sphere.position).normalize()
            };
        }
        
        return null;
    }
    
    // AABB (Axis-Aligned Bounding Box) collision
    aabbToAabb(obj1, obj2) {
        const box1 = this.getAABB(obj1);
        const box2 = this.getAABB(obj2);
        
        return (box1.min.x <= box2.max.x && box1.max.x >= box2.min.x) &&
               (box1.min.y <= box2.max.y && box1.max.y >= box2.min.y) &&
               (box1.min.z <= box2.max.z && box1.max.z >= box2.min.z);
    }
    
    getAABB(obj) {
        const box = new THREE.Box3().setFromObject(obj);
        return box;
    }
    
    // Collision response - separate overlapping objects
    separateObjects(obj1, obj2, collisionInfo) {
        if (!collisionInfo.colliding) return;
        
        const separationDistance = collisionInfo.penetration * 0.5;
        const separation = collisionInfo.normal.clone().multiplyScalar(separationDistance);
        
        obj1.position.sub(separation);
        obj2.position.add(separation);
    }
    
    // Add collision pair for checking
    addCollisionPair(obj1, obj2, callback) {
        this.collisionPairs.push({
            obj1: obj1,
            obj2: obj2,
            callback: callback,
            lastCollision: 0
        });
    }
    
    // Remove collision pair
    removeCollisionPair(obj1, obj2) {
        this.collisionPairs = this.collisionPairs.filter(pair => 
            !(pair.obj1 === obj1 && pair.obj2 === obj2) &&
            !(pair.obj1 === obj2 && pair.obj2 === obj1)
        );
    }
    
    // Check all registered collision pairs
    checkCollisions(deltaTime) {
        const currentTime = Date.now() * 0.001;
        
        for (let i = this.collisionPairs.length - 1; i >= 0; i--) {
            const pair = this.collisionPairs[i];
            
            // Skip if objects are inactive or removed
            if (!pair.obj1.userData.active || !pair.obj2.userData.active) {
                this.collisionPairs.splice(i, 1);
                continue;
            }
            
            // Check collision
            const collisionInfo = this.sphereToSphereDetailed(pair.obj1, pair.obj2);
            
            if (collisionInfo.colliding) {
                // Prevent rapid-fire collisions
                if (currentTime - pair.lastCollision > 0.1) {
                    pair.callback(pair.obj1, pair.obj2, collisionInfo);
                    pair.lastCollision = currentTime;
                }
            }
        }
    }
    
    // Broad phase collision detection using spatial grid
    updateSpatialGrid(objects) {
        this.spatialGrid.clear();
        
        for (const obj of objects) {
            if (obj.userData.active && obj.visible) {
                this.spatialGrid.insert(obj);
            }
        }
    }
    
    // Get potential collision candidates near an object
    getNearbyObjects(obj, radius = null) {
        const searchRadius = radius || obj.userData.boundingRadius * 2 || 2;
        return this.spatialGrid.query(obj.position, searchRadius);
    }
    
    // Check collision between an object and all nearby objects
    checkNearbyCollisions(obj, candidates, callback) {
        for (const candidate of candidates) {
            if (candidate === obj || !candidate.userData.active) continue;
            
            const collisionInfo = this.sphereToSphereDetailed(obj, candidate);
            if (collisionInfo.colliding) {
                callback(obj, candidate, collisionInfo);
            }
        }
    }
    
    // Sweep collision detection (for fast-moving objects)
    sweepSphere(startPos, endPos, radius, obstacles) {
        const direction = endPos.clone().sub(startPos);
        const distance = direction.length();
        direction.normalize();
        
        let minT = 1.0;
        let hitObject = null;
        
        for (const obstacle of obstacles) {
            if (!obstacle.userData.active) continue;
            
            const rayHit = this.rayToSphere(startPos, direction, obstacle);
            if (rayHit && rayHit.distance <= distance) {
                const t = (rayHit.distance - radius) / distance;
                if (t >= 0 && t < minT) {
                    minT = t;
                    hitObject = obstacle;
                }
            }
        }
        
        return {
            hit: hitObject !== null,
            object: hitObject,
            t: minT,
            position: startPos.clone().add(direction.multiplyScalar(distance * minT))
        };
    }
    
    // Enable/disable debug visualization
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    
    // Debug visualization of collision bounds
    visualizeCollisionBounds(scene) {
        if (!this.debugMode) return;
        
        // Remove old debug objects
        scene.traverse((child) => {
            if (child.userData.debugCollision) {
                scene.remove(child);
            }
        });
        
        // Add debug spheres for all active objects
        for (const pair of this.collisionPairs) {
            this.addDebugSphere(scene, pair.obj1);
            this.addDebugSphere(scene, pair.obj2);
        }
    }
    
    addDebugSphere(scene, obj) {
        if (!obj.userData.active) return;
        
        const radius = obj.userData.boundingRadius || 1;
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        const debugSphere = new THREE.Mesh(geometry, material);
        debugSphere.position.copy(obj.position);
        debugSphere.userData.debugCollision = true;
        
        scene.add(debugSphere);
        
        // Auto-remove after a short time
        setTimeout(() => {
            scene.remove(debugSphere);
            geometry.dispose();
            material.dispose();
        }, 100);
    }
}

// Spatial grid for efficient broad-phase collision detection
class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    
    getGridKey(x, y, z) {
        const gx = Math.floor(x / this.cellSize);
        const gy = Math.floor(y / this.cellSize);
        const gz = Math.floor(z / this.cellSize);
        return `${gx},${gy},${gz}`;
    }
    
    insert(obj) {
        const pos = obj.position;
        const radius = obj.userData.boundingRadius || 1;
        
        // Insert into all cells the object might occupy
        const minX = Math.floor((pos.x - radius) / this.cellSize);
        const maxX = Math.floor((pos.x + radius) / this.cellSize);
        const minY = Math.floor((pos.y - radius) / this.cellSize);
        const maxY = Math.floor((pos.y + radius) / this.cellSize);
        const minZ = Math.floor((pos.z - radius) / this.cellSize);
        const maxZ = Math.floor((pos.z + radius) / this.cellSize);
        
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${y},${z}`;
                    if (!this.grid.has(key)) {
                        this.grid.set(key, []);
                    }
                    this.grid.get(key).push(obj);
                }
            }
        }
    }
    
    query(position, radius) {
        const results = new Set();
        
        const minX = Math.floor((position.x - radius) / this.cellSize);
        const maxX = Math.floor((position.x + radius) / this.cellSize);
        const minY = Math.floor((position.y - radius) / this.cellSize);
        const maxY = Math.floor((position.y + radius) / this.cellSize);
        const minZ = Math.floor((position.z - radius) / this.cellSize);
        const maxZ = Math.floor((position.z + radius) / this.cellSize);
        
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${y},${z}`;
                    const cell = this.grid.get(key);
                    if (cell) {
                        cell.forEach(obj => results.add(obj));
                    }
                }
            }
        }
        
        return Array.from(results);
    }
    
    clear() {
        this.grid.clear();
    }
}