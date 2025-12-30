// music.js

class BattleBGM {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.allNotes = [];
        this.fixedBpm = 220;
        this.totalDuration = 0;
        this.schedulerTimer = null;
        this.nextNoteIndex = 0;
        this.startTime = 0;
        this.activeSources = [];
        // ★ 勝利ループ管理用
        this.victoryLoopTimer = null;
        this.seBuffers = {}; // 複数のSEを格納するオブジェクト
    }
    
    async loadSE(name, url) {
        if (!this.ctx) this.initContext();
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.seBuffers[name] = audioBuffer;
            console.log(`SE loaded: ${name}`);
        } catch (e) {
            console.error(`Failed to load SE: ${name}`, e);
        }
    }
    
    playSE(name, volume = 0.5) {
        if (!this.ctx || !this.seBuffers[name]) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.seBuffers[name];

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);

        source.connect(gainNode).connect(this.ctx.destination);
        source.start(0);
    }

    initContext() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, this.ctx.currentTime);
        osc.connect(g).connect(this.ctx.destination);
        osc.start(0);
        osc.stop(0.001);
    }
    
    playInstr(freqs, start, duration, vol, type = "sawtooth") {
        if (!this.ctx || start < this.ctx.currentTime) return;
        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = type;
            osc.frequency.setValueAtTime(f, start);
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(2500, start);

            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(vol, start + 0.02); 
            g.gain.linearRampToValueAtTime(0, start + duration + 0.05); 

            osc.connect(filter).connect(g).connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + duration + 0.1); 
            
            this.activeSources.push(osc);
            osc.onended = () => { this.activeSources = this.activeSources.filter(s => s !== osc); };
        });
    }

    playNote(freq, time, vol) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        const duration = 0.35;
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(vol * 0.2, time + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(g).connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + duration);
        this.activeSources.push(osc);
        osc.onended = () => { this.activeSources = this.activeSources.filter(s => s !== osc); };
    }

    start() {
        this.initContext();
        this.stop(); 
        this.isPlaying = true;
        this.nextNoteIndex = 0;
        this.startTime = this.ctx.currentTime + 0.2;
        this.schedule();
    }

    schedule() {
        if (!this.isPlaying) return;
        const lookAhead = 1.0; 
        const currentTime = this.ctx.currentTime - this.startTime;

        while (this.nextNoteIndex < this.allNotes.length && 
               this.allNotes[this.nextNoteIndex].time < currentTime + lookAhead) {
            const note = this.allNotes[this.nextNoteIndex];
            this.playNote(note.freq, this.startTime + note.time, 0.1);
            this.nextNoteIndex++;
        }

        if (this.nextNoteIndex >= this.allNotes.length) {
            this.nextNoteIndex = 0;
            this.startTime += this.totalDuration + 0.5;
        }
        this.schedulerTimer = setTimeout(() => this.schedule(), 200);
    }

    stop() {
        this.isPlaying = false;
        if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
        // ★ 勝利ループも確実に止める
        if (this.victoryLoopTimer) {
            clearTimeout(this.victoryLoopTimer);
            this.victoryLoopTimer = null;
        }
        this.activeSources.forEach(s => { try { s.stop(); s.disconnect(); } catch(e){} });
        this.activeSources = [];
    }

    playVictoryFanfare() {
        this.stop(); // ここでisPlaying = false、タイマーもクリア
        this.initContext();
        this.isPlaying = false;

        const now = this.ctx.currentTime + 0.1;
        const C4=261.6, E4=329.6, G4=392.0, Ab4=415.3, Bb4=466.2, C5=523.2, F4=349.2, D4=293.7;
        const s = 0.11;
        const v = 0.05; // ファンファーレ音量

        // 1. メインフレーズ
        this.playInstr([C5, G4, E4], now + 0, 0.1, v);
        this.playInstr([C5, G4, E4], now + s, 0.1, v);
        this.playInstr([C5, G4, E4], now + s * 2, 0.1, v);
        this.playInstr([C5, G4, E4], now + s * 3, 0.6, v); 
        this.playInstr([Ab4, 311.1, 207.6], now + 0.8, 0.4, v);
        this.playInstr([Bb4, 349.2, 233.1], now + 1.2, 0.4, v);

        const t3 = now + 1.6;
        this.playInstr([C5, G4, E4], t3, 0.2, v);
        this.playInstr([Bb4, F4, D4], t3 + 0.35, 0.12, v);
        this.playInstr([C5, G4, E4, 261.6], t3 + 0.47, 2.5, v + 0.02);

        // ループを開始
        this.startVictoryLoop(now + 3.0);
    }
    
    startVictoryLoop(startTime) {
        const self = this;
        // ループ専用のカウンター（展開を作る用）
        let loopCount = 0;

        const scheduleNext = (time) => {
            // 他の曲が始まったら確実に止める
            if (self.isPlaying) return;

            // 周波数定義
            const C3=130.8, G3=196.0, C4=261.6, D4=293.7, E4=329.6, F4=349.2, G4=392.0, A4=440.0, B4=493.8, C5=523.2;

            // --- A. 勇壮なベースライン（0.4秒刻みでリズムを作る） ---
            for (let i = 0; i < 8; i++) {
                const t = time + i * 0.4;
                // ドッ・ドッ・ドッ・ドッ
                self.playInstr([C3], t, 0.2, 0.05, "square"); 
                // オクターブ上の跳ねる音を追加
                self.playInstr([C4], t + 0.2, 0.1, 0.03, "square");
            }

            // --- B. 凱旋メロディ（0〜3.2秒の固定ループ） ---
            // 昔のRPGのフィールドや勝利後のような力強い旋律
            const melody = [
                { f: [C5, G4], d: 0, dur: 0.3 },
                { f: [C5, G4], d: 0.4, dur: 0.3 },
                { f: [G4], d: 0.8, dur: 0.3 },
                { f: [A4], d: 1.2, dur: 0.3 },
                { f: [B4], d: 1.6, dur: 0.6 },
                { f: [C5], d: 2.4, dur: 0.8 }
            ];

            melody.forEach(m => {
                // sawtoothとsquareを重ねて音を太くする
                self.playInstr(m.f, time + m.d, m.dur, 0.06, "sawtooth");
                self.playInstr(m.f, time + m.d, m.dur, 0.03, "square");
            });

            // --- C. ハーモニー（和音の厚み） ---
            self.playInstr([E4, G4], time, 1.5, 0.03, "triangle");
            self.playInstr([F4, A4], time + 1.6, 1.5, 0.03, "triangle");

            // 3.2秒ごとに次の「3.2秒分」を予約し続ける
            // タイマーの時間を少し早める（3200msではなく3000ms）ことで、Androidのラグによる音切れを防止
            self.victoryLoopTimer = setTimeout(() => {
                // contextのcurrentTimeを使って、常に「未来」の時間を指定
                const nextStartTime = Math.max(time + 3.2, self.ctx.currentTime + 0.1);
                scheduleNext(nextStartTime);
            }, 3000);
        };

        scheduleNext(startTime);
    }

    // loadMidiFromFile, parseTrack などの既存メソッドはそのまま維持
    async loadMidiFromFile(file) {
        const buffer = await file.arrayBuffer();
        const data = new DataView(buffer);
        let offset = 8 + data.getUint32(4);
        const numTracks = data.getUint16(10);
        const division = data.getUint16(12);

        this.allNotes = [];
        for (let i = 0; i < numTracks; i++) {
            if (offset >= data.byteLength) break;
            const trackLength = data.getUint32(offset + 4);
            offset += 8;
            this.parseTrack(data, offset, trackLength, division);
            offset += trackLength;
        }
        
        if (this.allNotes.length > 0) {
            this.allNotes.sort((a, b) => a.time - b.time);
            const firstSoundTime = this.allNotes[0].time;
            const lastSoundTime = this.allNotes[this.allNotes.length - 1].time;
            this.totalDuration = lastSoundTime - firstSoundTime;
        }
    }

    parseTrack(data, offset, length, division) {
        const end = offset + length;
        let timeTicks = 0;
        let lastStatus = 0;

        while (offset < end && offset < data.byteLength) {
            let delta = 0;
            while (true) {
                const b = data.getUint8(offset++);
                delta = (delta << 7) | (b & 0x7F);
                if (!(b & 0x80)) break;
            }
            timeTicks += delta;
            let timeSec = (timeTicks / division) * (60 / this.fixedBpm);

            let status = data.getUint8(offset++);
            if (!(status & 0x80)) { status = lastStatus; offset--; }
            lastStatus = status;

            const eventType = status & 0xF0;
            if (eventType === 0x90) {
                const noteNumber = data.getUint8(offset++);
                const velocity = data.getUint8(offset++);
                if (velocity > 0) {
                    const freq = 440 * Math.pow(2, (noteNumber - 69) / 12);
                    this.allNotes.push({ freq, time: timeSec, velocity: velocity / 127 });
                }
            } 
            else if (eventType === 0x80 || eventType === 0xA0 || eventType === 0xB0 || eventType === 0xE0) { offset += 2; }
            else if (eventType === 0xC0 || eventType === 0xD0) { offset += 1; }
            else if (status === 0xFF) { offset++; const metaLen = data.getUint8(offset++); offset += metaLen; }
        }
    }
    
    playAttack() { this.playSE('slash'); }
    playMagic() { this.playSE('magic'); }
    playMagicFire() { this.playSE('fire'); }
    playMagicMeteor() { this.playSE('meteor'); }
    playHeal() { this.playSE('heal'); }
    playMeditation(){ this.playSE('meditation'); }
    playKobu(){ this.playSE('kobu'); }
    playCover(){ this.playSE('cover'); }

    //  ダメージ音（鈍い衝撃音）
    playDamage() {
        if (!this.ctx) this.initContext();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = "square"; // 濁った音
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.2);

        g.gain.setValueAtTime(0.3, now);
        g.gain.linearRampToValueAtTime(0, now + 0.2);

        osc.connect(g).connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.2);
    }

}