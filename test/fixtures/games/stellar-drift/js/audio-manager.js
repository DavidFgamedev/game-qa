class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = new Map();
        this.musicVolume = 0.3;
        this.sfxVolume = 0.7;
        this.masterVolume = 1.0;
        this.initialized = false;
        
        // Audio sources - using procedurally generated audio
        this.audioSources = {
            engineHum: { frequency: 120, type: 'sawtooth', duration: 0.1 },
            crystalChime: { frequency: 880, type: 'sine', duration: 0.3 },
            rareCrystal: { frequency: 1320, type: 'sine', duration: 0.5 },
            fuelCrystal: { frequency: 660, type: 'triangle', duration: 0.4 },
            explosion: { frequency: 80, type: 'square', duration: 0.8 },
            ambientSpace: { frequency: 40, type: 'sine', duration: 5.0 }
        };
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await this.audioContext.resume();
            this.generateSounds();
            this.initialized = true;
        } catch (error) {
            console.warn('Audio initialization failed:', error);
        }
    }
    
    generateSounds() {
        for (const [name, config] of Object.entries(this.audioSources)) {
            this.sounds.set(name, this.createSound(config));
        }
    }
    
    createSound(config) {
        const { frequency, type, duration } = config;
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            const envelope = this.createEnvelope(time, duration);
            
            switch (type) {
                case 'sine':
                    data[i] = Math.sin(2 * Math.PI * frequency * time) * envelope;
                    break;
                case 'square':
                    data[i] = Math.sign(Math.sin(2 * Math.PI * frequency * time)) * envelope;
                    break;
                case 'sawtooth':
                    data[i] = (2 * ((frequency * time) % 1) - 1) * envelope;
                    break;
                case 'triangle':
                    const saw = (2 * ((frequency * time) % 1) - 1);
                    data[i] = (2 * Math.abs(saw) - 1) * envelope;
                    break;
            }
            
            // Add some harmonics for richer sound
            if (name === 'crystalChime' || name === 'rareCrystal') {
                data[i] += Math.sin(2 * Math.PI * frequency * 2 * time) * envelope * 0.3;
                data[i] += Math.sin(2 * Math.PI * frequency * 3 * time) * envelope * 0.1;
            }
        }
        
        return buffer;
    }
    
    createEnvelope(time, duration) {
        const attackTime = duration * 0.1;
        const decayTime = duration * 0.2;
        const sustainLevel = 0.6;
        const releaseTime = duration * 0.7;
        
        if (time < attackTime) {
            return time / attackTime;
        } else if (time < attackTime + decayTime) {
            return 1 - (1 - sustainLevel) * ((time - attackTime) / decayTime);
        } else if (time < duration - releaseTime) {
            return sustainLevel;
        } else {
            return sustainLevel * (1 - (time - (duration - releaseTime)) / releaseTime);
        }
    }
    
    playSound(name, volume = 1.0, pitch = 1.0, loop = false) {
        if (!this.initialized || !this.sounds.has(name)) return null;
        
        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.sounds.get(name);
            source.playbackRate.value = pitch;
            source.loop = loop;
            
            gainNode.gain.value = volume * this.sfxVolume * this.masterVolume;
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            source.start();
            
            if (!loop) {
                source.stop(this.audioContext.currentTime + source.buffer.duration / pitch);
            }
            
            return { source, gainNode };
        } catch (error) {
            console.warn('Error playing sound:', error);
            return null;
        }
    }
    
    playEngineHum() {
        if (!this.engineHumSource) {
            this.engineHumSource = this.playSound('engineHum', 0.3, 1.0, true);
        }
    }
    
    stopEngineHum() {
        if (this.engineHumSource) {
            this.engineHumSource.source.stop();
            this.engineHumSource = null;
        }
    }
    
    updateEngineHum(throttle) {
        if (this.engineHumSource) {
            const volume = 0.2 + throttle * 0.3;
            const pitch = 0.8 + throttle * 0.4;
            this.engineHumSource.gainNode.gain.value = volume * this.sfxVolume * this.masterVolume;
            this.engineHumSource.source.playbackRate.value = pitch;
        }
    }
    
    playCrystalCollect(crystalType = 'standard') {
        const soundMap = {
            'standard': 'crystalChime',
            'rare': 'rareCrystal',
            'fuel': 'fuelCrystal'
        };
        
        const soundName = soundMap[crystalType] || 'crystalChime';
        this.playSound(soundName, 0.5, 1.0 + Math.random() * 0.2);
    }
    
    playExplosion() {
        this.playSound('explosion', 0.8, 0.8 + Math.random() * 0.4);
    }
    
    startAmbientSpace() {
        if (!this.ambientSource) {
            this.ambientSource = this.playSound('ambientSpace', 0.1, 0.5, true);
        }
    }
    
    stopAmbientSpace() {
        if (this.ambientSource) {
            this.ambientSource.source.stop();
            this.ambientSource = null;
        }
    }
    
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
    
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }
    
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
    }
    
    cleanup() {
        this.stopEngineHum();
        this.stopAmbientSpace();
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}