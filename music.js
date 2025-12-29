// music.js

class BattleBGM {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.allNotes = [];
        this.fixedBpm = 220;
        this.totalDuration = 0; // 曲の長さを保存
        this.loopTimer = null;   // ループ用のタイマー
        
        
    }

    initContext() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
    }

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
            
            // 【重要】曲の総演奏時間を計算
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

    playNote(freq, startTime, vol) {
        if (startTime < this.ctx.currentTime) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, startTime);

        const duration = 0.35; 
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(vol * 0.2, startTime + 0.002); 
        g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(g).connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    start() {
        if (this.allNotes.length === 0) return;
        this.initContext();
        this.isPlaying = true;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const firstSoundTime = this.allNotes[0].time;
        const startTime = this.ctx.currentTime + 0.1;

        // 全音符を予約
        this.allNotes.forEach(note => {
            const pTime = startTime + (note.time - firstSoundTime);
            if (pTime >= this.ctx.currentTime) {
                this.playNote(note.freq, pTime, note.velocity);
            }
        });

        // 【ループ処理】
        // 全音符が鳴り終わる頃（totalDuration）に、自分自身（start）をもう一度呼ぶ
        if (this.loopTimer) clearTimeout(this.loopTimer);
        const waitTime = 2.0;
        
        this.loopTimer = setTimeout(() => {
            if (this.isPlaying) {
                console.log("ループ再生開始");
                this.start();
            }
        }, (this.totalDuration + waitTime) * 1000); // 秒をミリ秒に変換
    }

    stop() {
        this.isPlaying = false;
        if (this.loopTimer) clearTimeout(this.loopTimer);
        // ctx.close() は呼ばず、音のスケジュールを管理するフラグだけ下ろす
    }
 
    // 凱旋のループBGM：落ち着いた気品のあるリザルト曲
    playVictoryLoop() {
        this.isPlaying = true;
        const loop = () => {
            if (!this.isPlaying) return;
            const now = this.ctx.currentTime;
            const beat = 0.75; // BPM 80相当のゆったりしたテンポ

            const playSoft = (f, start, vol = 0.03, type = "sine") => {
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(f, start);
                g.gain.setValueAtTime(0, start);
                g.gain.linearRampToValueAtTime(vol, start + 0.2);
                g.gain.exponentialRampToValueAtTime(0.0001, start + beat * 4);
                osc.connect(g).connect(this.ctx.destination);
                osc.start(start);
                osc.stop(start + beat * 4.1);
            };

            // 幻想的な響き (C -> F -> Bb -> G)
            const chords = [
                [261.6, 329.6, 392.0], // C
                [349.2, 440.0, 523.2], // F
                [233.1, 293.7, 349.2], // Bb
                [196.0, 246.9, 293.7]  // G
            ];

            chords.forEach((chord, i) => {
                const time = now + i * (beat * 2);
                chord.forEach(f => playSoft(f, time, 0.03, "triangle"));
                playSoft(chord[2] * 2, time + beat, 0.02, "sine"); // 高音の煌めき
            });
            
            if (this.loopTimer) clearTimeout(this.loopTimer);
            this.loopTimer = setTimeout(loop, beat * 8 * 1000);
        };
        loop();
    }

    async playVictoryFanfare() {
        this.isPlaying = false;
        if (this.loopTimer) clearTimeout(this.loopTimer);
        
        if (this.ctx) { 
            try { await this.ctx.close(); } catch(e) {}
            this.ctx = null; 
        }

        this.initContext();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        
        const now = this.ctx.currentTime + 0.1;

        const playInstr = (freqs, start, duration, vol = 0.1) => {
            freqs.forEach((f) => {
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();

                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(f, start);
                
                filter.type = "lowpass";
                filter.frequency.setValueAtTime(2500, start);

                g.gain.setValueAtTime(0, start);
                g.gain.linearRampToValueAtTime(vol, start + 0.03); 
                g.gain.linearRampToValueAtTime(vol * 0.7, start + duration);
                g.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.4);
                
                osc.connect(filter).connect(g).connect(this.ctx.destination);
                osc.start(start);
                osc.stop(start + duration + 0.5);
            });
        };

        const C4=261.6, D4=293.7, E4=329.6, F4=349.2, G4=392.0, Ab4=415.3, Bb4=466.2, C5=523.2;
        const s = 0.11; // 16分音符

        // --- 1. ドドドドー ---
        playInstr([C5, G4, E4], now + 0, 0.08, 0.12);
        playInstr([C5, G4, E4], now + s, 0.08, 0.12);
        playInstr([C5, G4, E4], now + s * 2, 0.08, 0.12);
        playInstr([C5, G4, E4], now + s * 3, 0.4, 0.15); 

        // --- 2. ラ♭ー ・ シ♭ー ---
        const t2 = now + 0.8;
        playInstr([Ab4, 311.1, 207.6], t2, 0.4, 0.12); // Ab, Eb, Ab(low)
        playInstr([Bb4, 349.2, 233.1], t2 + 0.5, 0.4, 0.12); // Bb, F, Bb(low)

       // --- 3. ドっシ♭ドー！ (タメ強調・シ♭しっかり版) ---
        const t3 = t2 + 1.0;
        const pause = 0.3; // タメをしっかりとる（0.3秒）

        // 最初の「ド」
        playInstr([C5, G4, E4], t3, 0.12, 0.12);       
        
        // 「シ♭」：しっかり音の長さを確保（0.12）しつつ、タメた後に鳴らす
        playInstr([Bb4, F4, D4], t3 + pause, 0.12, 0.12);  
        
        // 最後の「ドー！」：シ♭の直後に力強く解決
        playInstr([C5, G4, E4, 261.6], t3 + pause + 0.12, 2.5, 0.12);

        // 最後の「ドー！」が鳴り響いている最中、あるいは終わる頃にループへ移行
        this.loopTimer = setTimeout(() => {
            this.playVictoryLoop();
        }, 4000); // 4秒後にループBGM開始
    }
    
    
    
}


