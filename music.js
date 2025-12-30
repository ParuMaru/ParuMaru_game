/**
 * ゲーム内のBGMおよびSE（効果音）を制御するクラス
 * Web Audio APIを使用してリアルタイムに音を合成・再生します
 */
class BattleBGM {
    constructor() {
        this.ctx = null;           // AudioContext（ブラウザの音響エンジン）
        this.isPlaying = false;    // BGM再生中フラグ
        this.allNotes = [];        // MIDIから解析した音符データ
        this.fixedBpm = 220;       // 再生速度
        this.totalDuration = 0;    // 曲の総再生時間
        this.schedulerTimer = null; // 次の音を予約するためのタイマー
        this.nextNoteIndex = 0;    // 次に再生する音符のインデックス
        this.startTime = 0;        // 再生開始時刻
        this.activeSources = [];   // 現在鳴っている音源のリスト
        
        // 勝利ループ管理
        this.victoryLoopTimer = null;
        this.seBuffers = {};       // ロードしたSEのオーディオデータを格納
    }
    
    /**
     * 外部音声ファイル(wav/mp3等)をロードしてSEとして登録
     */
    async loadSE(name, url) {
        if (!this.ctx) this.initContext();
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            // ブラウザが扱えるデコード済みデータに変換
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.seBuffers[name] = audioBuffer;
            console.log(`SE loaded: ${name}`);
        } catch (e) {
            console.error(`Failed to load SE: ${name}`, e);
        }
    }
    
    /**
     * 登録されたSEを再生
     */
    playSE(name, volume = 0.5) {
        if (!this.ctx || !this.seBuffers[name]) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.seBuffers[name];

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);

        source.connect(gainNode).connect(this.ctx.destination);
        source.start(0);
    }

    /**
     * AudioContextの初期化（ユーザーの操作後に呼び出す必要がある）
     */
    initContext() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        // 初回起動時の無音バッファ再生（iOS/Android対策）
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, this.ctx.currentTime);
        osc.connect(g).connect(this.ctx.destination);
        osc.start(0);
        osc.stop(0.001);
    }
    
    /**
     * 合成音（楽器音）の生成
     * @param {Array} freqs - 周波数の配列（和音対応）
     * @param {number} start - 開始時間
     * @param {number} duration - 持続時間
     * @param {number} vol - 音量
     * @param {string} type - 波形（sawtooth, square, triangle, sine）
     */
    playInstr(freqs, start, duration, vol, type = "sawtooth") {
        if (!this.ctx || start < this.ctx.currentTime) return;
        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = type;
            osc.frequency.setValueAtTime(f, start);
            
            // ローパスフィルターで高音を少し削り、聴きやすくする
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(2500, start);

            // エンベロープ（音量の変化）の設定
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(vol, start + 0.02); // アタック
            g.gain.linearRampToValueAtTime(0, start + duration + 0.05); // リリース

            osc.connect(filter).connect(g).connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + duration + 0.1); 
            
            this.activeSources.push(osc);
            osc.onended = () => { this.activeSources = this.activeSources.filter(s => s !== osc); };
        });
    }

    /**
     * BGM用の単音再生（MIDI再生エンジン用）
     */
    playNote(freq, time, vol) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        const duration = 0.35;
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(vol * 0.2, time + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, time + duration); // 指数関数的に減衰
        osc.connect(g).connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + duration);
        this.activeSources.push(osc);
        osc.onended = () => { this.activeSources = this.activeSources.filter(s => s !== osc); };
    }

    /**
     * BGMの再生開始
     */
    start() {
        this.initContext();
        this.stop(); 
        this.isPlaying = true;
        this.nextNoteIndex = 0;
        this.startTime = this.ctx.currentTime + 0.2;
        this.schedule();
    }

    /**
     * 音符のスケジューリング（少し未来の音を予約することでラグを防ぐ）
     */
    schedule() {
        if (!this.isPlaying) return;
        const lookAhead = 1.0; // 1秒先まで予約
        const currentTime = this.ctx.currentTime - this.startTime;

        while (this.nextNoteIndex < this.allNotes.length && 
               this.allNotes[this.nextNoteIndex].time < currentTime + lookAhead) {
            const note = this.allNotes[this.nextNoteIndex];
            this.playNote(note.freq, this.startTime + note.time, 0.1);
            this.nextNoteIndex++;
        }

        // ループ再生の処理
        if (this.nextNoteIndex >= this.allNotes.length) {
            this.nextNoteIndex = 0;
            this.startTime += this.totalDuration + 0.5;
        }
        this.schedulerTimer = setTimeout(() => this.schedule(), 200);
    }

    /**
     * 全ての音を停止
     */
    stop() {
        this.isPlaying = false;
        if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
        if (this.victoryLoopTimer) {
            clearTimeout(this.victoryLoopTimer);
            this.victoryLoopTimer = null;
        }
        this.activeSources.forEach(s => { try { s.stop(); s.disconnect(); } catch(e){} });
        this.activeSources = [];
    }

    /**
     * 勝利ファンファーレの演奏
     */
    playVictoryFanfare() {
        this.stop(); 
        this.initContext();
        this.isPlaying = false;

        const now = this.ctx.currentTime + 0.1;
        // 周波数の定義
        const C4=261.6, E4=329.6, G4=392.0, Ab4=415.3, Bb4=466.2, C5=523.2, F4=349.2, D4=293.7;
        const s = 0.11; // テンポ設定
        const v = 0.05; // 音量

        // 1. メインフレーズ（有名な「タタタター！」のメロディ）
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

        // 3秒後にループBGMへ移行
        this.startVictoryLoop(now + 3.0);
    }
    
    /**
     * 勝利後の待機ループBGM
     */
    startVictoryLoop(startTime) {
        const self = this;
        const scheduleNext = (time) => {
            if (self.isPlaying) return; // 他のBGM（戦闘開始等）が優先されたら停止

            const C3=130.8, G3=196.0, C4=261.6, D4=293.7, E4=329.6, F4=349.2, G4=392.0, A4=440.0, B4=493.8, C5=523.2;

            // --- A. ベースライン（ドッ・ドッのリズム） ---
            for (let i = 0; i < 8; i++) {
                const t = time + i * 0.4;
                self.playInstr([C3], t, 0.2, 0.05, "square"); 
                self.playInstr([C4], t + 0.2, 0.1, 0.03, "square");
            }

            // --- B. 凱旋メロディ（力強い旋律） ---
            const melody = [
                { f: [C5, G4], d: 0, dur: 0.3 },
                { f: [C5, G4], d: 0.4, dur: 0.3 },
                { f: [G4], d: 0.8, dur: 0.3 },
                { f: [A4], d: 1.2, dur: 0.3 },
                { f: [B4], d: 1.6, dur: 0.6 },
                { f: [C5], d: 2.4, dur: 0.8 }
            ];

            melody.forEach(m => {
                // 複数の波形を重ねて音に厚みを出す
                self.playInstr(m.f, time + m.d, m.dur, 0.06, "sawtooth");
                self.playInstr(m.f, time + m.d, m.dur, 0.03, "square");
            });

            // --- C. 背後の和音 ---
            self.playInstr([E4, G4], time, 1.5, 0.03, "triangle");
            self.playInstr([F4, A4], time + 1.6, 1.5, 0.03, "triangle");

            // 再帰的に次の小節を予約（ラグ対策のため実際の時間より早めに計算）
            self.victoryLoopTimer = setTimeout(() => {
                const nextStartTime = Math.max(time + 3.2, self.ctx.currentTime + 0.1);
                scheduleNext(nextStartTime);
            }, 3000);
        };

        scheduleNext(startTime);
    }

    /**
     * MIDIファイルをバイナリ解析して音符データに変換
     */
    async loadMidiFromFile(file) {
        const buffer = await file.arrayBuffer();
        const data = new DataView(buffer);
        // MIDIヘッダの解析
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

    /**
     * MIDIトラック内のイベント（Note Onなど）を解析
     */
    parseTrack(data, offset, length, division) {
        const end = offset + length;
        let timeTicks = 0;
        let lastStatus = 0;

        while (offset < end && offset < data.byteLength) {
            // 可変長数値表現(Delta Time)の読み取り
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
            if (eventType === 0x90) { // Note On（音を鳴らす）
                const noteNumber = data.getUint8(offset++);
                const velocity = data.getUint8(offset++);
                if (velocity > 0) {
                    // MIDIノート番号を周波数(Hz)に変換
                    const freq = 440 * Math.pow(2, (noteNumber - 69) / 12);
                    this.allNotes.push({ freq, time: timeSec, velocity: velocity / 127 });
                }
            } 
            // その他のイベント（スキップ処理）
            else if (eventType === 0x80 || eventType === 0xA0 || eventType === 0xB0 || eventType === 0xE0) { offset += 2; }
            else if (eventType === 0xC0 || eventType === 0xD0) { offset += 1; }
            else if (status === 0xFF) { offset++; const metaLen = data.getUint8(offset++); offset += metaLen; }
        }
    }
    
    // 各アクションに対応するSEの再生ショートカット
    playAttack() { this.playSE('slash'); }
    playMagic() { this.playSE('magic'); }
    playMagicFire() { this.playSE('fire'); }
    playMagicMeteor() { this.playSE('meteor'); }
    playHeal() { this.playSE('heal'); }
    playMeditation(){ this.playSE('meditation'); }
    playKobu(){ this.playSE('kobu'); }
    playCover(){ this.playSE('cover'); }

    /**
     * ダメージ音（プログラムによる合成音）
     */
    playDamage() {
        if (!this.ctx) this.initContext();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = "square"; 
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.2); // 音程を急激に下げる

        g.gain.setValueAtTime(0.1, now);
        g.gain.linearRampToValueAtTime(0, now + 0.2);

        osc.connect(g).connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.2);
    }
}