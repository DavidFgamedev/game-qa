class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = {
            x: 0,
            y: 0,
            buttons: {}
        };
        
        this.touch = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            joystickActive: false,
            joystickX: 0,
            joystickY: 0
        };
        
        this.gamepadIndex = -1;
        this.gamepad = null;
        
        // Input mappings
        this.keyMap = {
            'KeyW': 'up',
            'KeyS': 'down',
            'KeyA': 'left',
            'KeyD': 'right',
            'KeyQ': 'backward',
            'KeyE': 'forward',
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'Space': 'action',
            'Enter': 'start',
            'Escape': 'menu'
        };
        
        this.setupEventListeners();
        this.setupMobileControls();
        this.detectMobile();
    }
    
    detectMobile() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            this.showMobileControls();
        }
    }
    
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            event.preventDefault();
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
            event.preventDefault();
        });
        
        // Mouse events
        document.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });
        
        document.addEventListener('mousedown', (event) => {
            this.mouse.buttons[event.button] = true;
        });
        
        document.addEventListener('mouseup', (event) => {
            this.mouse.buttons[event.button] = false;
        });
        
        // Touch events for mobile
        document.addEventListener('touchstart', (event) => this.handleTouchStart(event), { passive: false });
        document.addEventListener('touchmove', (event) => this.handleTouchMove(event), { passive: false });
        document.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: false });
        
        // Gamepad connection events
        window.addEventListener('gamepadconnected', (event) => {
            console.log('Gamepad connected:', event.gamepad);
            this.gamepadIndex = event.gamepad.index;
        });
        
        window.addEventListener('gamepaddisconnected', (event) => {
            console.log('Gamepad disconnected');
            if (event.gamepad.index === this.gamepadIndex) {
                this.gamepadIndex = -1;
                this.gamepad = null;
            }
        });
        
        // Prevent context menu on right click
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        // Prevent default touch behaviors
        document.addEventListener('touchstart', (event) => {
            if (event.touches.length > 1) {
                event.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (event) => {
            event.preventDefault();
        }, { passive: false });
    }
    
    setupMobileControls() {
        const joystickOuter = document.getElementById('joystick-outer');
        const joystickInner = document.getElementById('joystick-inner');
        
        if (!joystickOuter || !joystickInner) return;
        
        joystickOuter.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.touch.joystickActive = true;
            
            const rect = joystickOuter.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            this.touch.startX = centerX;
            this.touch.startY = centerY;
        });
        
        document.addEventListener('touchmove', (event) => {
            if (!this.touch.joystickActive) return;
            event.preventDefault();
            
            const touch = event.touches[0];
            const deltaX = touch.clientX - this.touch.startX;
            const deltaY = touch.clientY - this.touch.startY;
            
            const maxDistance = 30; // Maximum distance from center
            const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxDistance);
            const angle = Math.atan2(deltaY, deltaX);
            
            const constrainedX = Math.cos(angle) * distance;
            const constrainedY = Math.sin(angle) * distance;
            
            joystickInner.style.transform = `translate(-50%, -50%) translate(${constrainedX}px, ${constrainedY}px)`;
            
            // Normalize to -1 to 1 range
            this.touch.joystickX = constrainedX / maxDistance;
            this.touch.joystickY = -constrainedY / maxDistance; // Invert Y for game coordinates
        });
        
        document.addEventListener('touchend', (event) => {
            if (!this.touch.joystickActive) return;
            
            this.touch.joystickActive = false;
            this.touch.joystickX = 0;
            this.touch.joystickY = 0;
            
            joystickInner.style.transform = 'translate(-50%, -50%)';
        });
    }
    
    handleTouchStart(event) {
        if (event.target.closest('#mobile-controls')) return; // Let joystick handle its own events
        
        this.touch.active = true;
        const touch = event.touches[0];
        this.touch.startX = touch.clientX;
        this.touch.startY = touch.clientY;
        this.touch.currentX = touch.clientX;
        this.touch.currentY = touch.clientY;
    }
    
    handleTouchMove(event) {
        if (!this.touch.active || event.target.closest('#mobile-controls')) return;
        
        const touch = event.touches[0];
        this.touch.currentX = touch.clientX;
        this.touch.currentY = touch.clientY;
    }
    
    handleTouchEnd(event) {
        if (event.target.closest('#mobile-controls')) return;
        
        this.touch.active = false;
    }
    
    updateGamepad() {
        if (this.gamepadIndex !== -1) {
            const gamepads = navigator.getGamepads();
            this.gamepad = gamepads[this.gamepadIndex];
        }
    }
    
    getInput() {
        this.updateGamepad();
        
        const input = {
            left: false,
            right: false,
            up: false,
            down: false,
            forward: false,
            backward: false,
            action: false,
            start: false,
            menu: false
        };
        
        // Keyboard input
        for (const [key, action] of Object.entries(this.keyMap)) {
            if (this.keys[key]) {
                input[action] = true;
            }
        }
        
        // Mouse input (for menu navigation)
        if (this.mouse.buttons[0]) {
            input.action = true;
        }
        
        // Touch/Mobile input
        if (this.touch.joystickActive) {
            const deadzone = 0.2;
            
            if (Math.abs(this.touch.joystickX) > deadzone) {
                input.left = this.touch.joystickX < -deadzone;
                input.right = this.touch.joystickX > deadzone;
            }
            
            if (Math.abs(this.touch.joystickY) > deadzone) {
                input.up = this.touch.joystickY > deadzone;
                input.down = this.touch.joystickY < -deadzone;
            }
        }
        
        // Simple touch controls (swipe-like)
        if (this.touch.active && !this.touch.joystickActive) {
            const deltaX = this.touch.currentX - this.touch.startX;
            const deltaY = this.touch.currentY - this.touch.startY;
            const sensitivity = 50;
            
            if (Math.abs(deltaX) > sensitivity) {
                input.left = deltaX < 0;
                input.right = deltaX > 0;
            }
            
            if (Math.abs(deltaY) > sensitivity) {
                input.up = deltaY < 0;
                input.down = deltaY > 0;
            }
        }
        
        // Gamepad input
        if (this.gamepad) {
            const deadzone = 0.1;
            
            // Left stick
            if (Math.abs(this.gamepad.axes[0]) > deadzone) {
                input.left = this.gamepad.axes[0] < -deadzone;
                input.right = this.gamepad.axes[0] > deadzone;
            }
            
            if (Math.abs(this.gamepad.axes[1]) > deadzone) {
                input.up = this.gamepad.axes[1] < -deadzone;
                input.down = this.gamepad.axes[1] > deadzone;
            }
            
            // Right stick for forward/backward
            if (Math.abs(this.gamepad.axes[3]) > deadzone) {
                input.forward = this.gamepad.axes[3] < -deadzone;
                input.backward = this.gamepad.axes[3] > deadzone;
            }
            
            // D-pad
            input.left = input.left || this.gamepad.buttons[14]?.pressed;
            input.right = input.right || this.gamepad.buttons[15]?.pressed;
            input.up = input.up || this.gamepad.buttons[12]?.pressed;
            input.down = input.down || this.gamepad.buttons[13]?.pressed;
            
            // Buttons
            input.action = input.action || this.gamepad.buttons[0]?.pressed; // A/Cross
            input.start = input.start || this.gamepad.buttons[9]?.pressed; // Start
            input.menu = input.menu || this.gamepad.buttons[8]?.pressed; // Select/Menu
            
            // Triggers
            input.forward = input.forward || this.gamepad.buttons[7]?.pressed; // RT
            input.backward = input.backward || this.gamepad.buttons[6]?.pressed; // LT
        }
        
        return input;
    }
    
    showMobileControls() {
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.remove('hidden');
        }
    }
    
    hideMobileControls() {
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.add('hidden');
        }
    }
    
    // Utility methods for specific input queries
    isPressed(action) {
        const input = this.getInput();
        return input[action];
    }
    
    isKeyPressed(key) {
        return this.keys[key] || false;
    }
    
    getMousePosition() {
        return { x: this.mouse.x, y: this.mouse.y };
    }
    
    getTouchPosition() {
        if (!this.touch.active) return null;
        
        return {
            x: (this.touch.currentX / window.innerWidth) * 2 - 1,
            y: -(this.touch.currentY / window.innerHeight) * 2 + 1,
            deltaX: this.touch.currentX - this.touch.startX,
            deltaY: this.touch.currentY - this.touch.startY
        };
    }
    
    getJoystickInput() {
        return {
            x: this.touch.joystickX,
            y: this.touch.joystickY,
            active: this.touch.joystickActive
        };
    }
    
    // Haptic feedback for mobile devices
    vibrate(pattern = [100]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    // Reset input state (useful for scene transitions)
    reset() {
        this.keys = {};
        this.mouse.buttons = {};
        this.touch.active = false;
        this.touch.joystickActive = false;
        this.touch.joystickX = 0;
        this.touch.joystickY = 0;
    }
    
    // Clean up event listeners
    cleanup() {
        // Remove all event listeners
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);
        document.removeEventListener('mousemove', this.mousemoveHandler);
        document.removeEventListener('mousedown', this.mousedownHandler);
        document.removeEventListener('mouseup', this.mouseupHandler);
        document.removeEventListener('touchstart', this.touchstartHandler);
        document.removeEventListener('touchmove', this.touchmoveHandler);
        document.removeEventListener('touchend', this.touchendHandler);
        document.removeEventListener('contextmenu', this.contextmenuHandler);
        
        window.removeEventListener('gamepadconnected', this.gamepadConnectedHandler);
        window.removeEventListener('gamepaddisconnected', this.gamepadDisconnectedHandler);
    }
}