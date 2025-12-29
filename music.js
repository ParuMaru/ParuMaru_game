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
    }

    initContext() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        // 許可確定用のダミー音
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, this.ctx.currentTime);
        osc.connect(g).connect(this.ctx.destination);
        osc.start(0);
        osc.stop(0.001);
    }

    playNote(freq, time, vol) {
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

    // ★ 逐次予約システム（Scheduler）
    start() {
        this.initContext();
        this.stop(); // 二重再生防止
        this.isPlaying = true;
        this.nextNoteIndex = 0;
        this.startTime = this.ctx.currentTime + 0.2; // 0.2秒のタメを作る
        this.schedule();
    }

    schedule() {
        if (!this.isPlaying) return;

        // 常に「今の1秒先」までの音を予約し続ける
        const lookAhead = 1.0; 
        const currentTime = this.ctx.currentTime - this.startTime;

        while (this.nextNoteIndex < this.allNotes.length && 
               this.allNotes[this.nextNoteIndex].time < currentTime + lookAhead) {
            const note = this.allNotes[this.nextNoteIndex];
            this.playNote(note.freq, this.startTime + note.time, 0.1);
            this.nextNoteIndex++;
        }

        // 全ての音を出し切ったらループ処理
        if (this.nextNoteIndex >= this.allNotes.length) {
            this.nextNoteIndex = 0;
            this.startTime += this.totalDuration + 0.5; // 曲の長さ分ずらしてループ
        }

        // 200ミリ秒ごとに次の音がないかチェックしに行く
        this.schedulerTimer = setTimeout(() => this.schedule(), 200);
    }

    stop() {
        this.isPlaying = false;
        if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
        this.activeSources.forEach(s => { try { s.stop(); s.disconnect(); } catch(e){} });
        this.activeSources = [];
    }

    // ファンファーレ（一回きりなので一気に予約でOK）
    playVictoryFanfare() {
        this.stop();
        this.initContext();
        const now = this.ctx.currentTime + 0.1;
        const play = (freqs, start, duration, vol) => {
            freqs.forEach(f => this.playNote(f, start, vol));
        };
        const s = 0.11;
        const C5=523.2, G4=392.0, E4=329.6, Ab4=415.3, Bb4=466.2, F4=349.2, D4=293.7;
        play([C5, G4, E4], now, 0.08, 0.12);
        play([C5, G4, E4], now + s, 0.08, 0.12);
        play([C5, G4, E4], now + s * 2, 0.08, 0.12);
        play([C5, G4, E4], now + s * 3, 0.4, 0.15);
        play([Ab4, 311.1, 207.6], now + 0.8, 0.4, 0.12);
        play([Bb4, 349.2, 233.1], now + 1.2, 0.4, 0.12);
        play([C5, G4, E4], now + 1.8, 0.12, 0.1);
        play([Bb4, F4, D4], now + 2.15, 0.12, 0.1);
        play([C5, G4, E4], now + 2.27, 2.5, 0.12);
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
    
}


