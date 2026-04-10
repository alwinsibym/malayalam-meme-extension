"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemeManager = exports.MemeCategory = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const soundPlayer = __importStar(require("sound-play"));
var MemeCategory;
(function (MemeCategory) {
    MemeCategory["Startup"] = "Startup";
    MemeCategory["FolderOpen"] = "FolderOpen";
    MemeCategory["Inactivity"] = "Inactivity";
    MemeCategory["TerminalError"] = "TerminalError";
    MemeCategory["ProjectError"] = "ProjectError";
    MemeCategory["DeepWork"] = "DeepWork";
    MemeCategory["Success"] = "Success";
    MemeCategory["GitPush"] = "GitPush";
    MemeCategory["Shutdown"] = "Shutdown";
})(MemeCategory || (exports.MemeCategory = MemeCategory = {}));
class MemeManager {
    context;
    static instance;
    localAssets = new Map();
    remoteAssets = new Map();
    cacheDir;
    lastPlayedTime = 0;
    isPlaying = false;
    playbackTimeout;
    // Session stats & Gamification
    stats = {
        totalPlayed: 0,
        categoryCounts: {},
        sessionStart: Date.now(),
        lastCategory: '',
        favoriteCategory: '',
        devPoints: 0,
        wpm: 0,
        rank: 'Junior Dev',
        mood: 'Focus'
    };
    _onDidPlay = new vscode.EventEmitter();
    onDidPlay = this._onDidPlay.event;
    _onStatsUpdate = new vscode.EventEmitter();
    onStatsUpdate = this._onStatsUpdate.event;
    constructor(context) {
        this.context = context;
        this.cacheDir = path.join(os.tmpdir(), 'malayalam-memes-cache');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        this.initializeLocalAssets();
    }
    static getInstance(context) {
        if (!MemeManager.instance) {
            MemeManager.instance = new MemeManager(context);
        }
        return MemeManager.instance;
    }
    getStats() {
        return { ...this.stats };
    }
    /** Updates WPM and adds points */
    updateActivity(charsTyped, currentWpm) {
        this.stats.wpm = currentWpm;
        this.stats.devPoints += Math.floor(charsTyped / 10);
        this.updateMoodAndRank();
        this._onStatsUpdate.fire(this.stats);
    }
    updateMoodAndRank() {
        // Mood Logic
        if (this.stats.wpm > 60)
            this.stats.mood = 'Mass';
        else if (this.stats.wpm > 100)
            this.stats.mood = 'God Mode';
        else if (this.stats.wpm < 5 && this.stats.totalPlayed > 0)
            this.stats.mood = 'Idle';
        // Ranking Logic
        if (this.stats.devPoints > 10000)
            this.stats.rank = 'Sagar Alias Jacky';
        else if (this.stats.devPoints > 5000)
            this.stats.rank = 'Legendary Coder';
        else if (this.stats.devPoints > 2000)
            this.stats.rank = 'Senior Dev';
        else if (this.stats.devPoints > 500)
            this.stats.rank = 'Mid-Level Dev';
    }
    initializeLocalAssets() {
        const assetsPath = path.join(this.context.extensionPath, 'assets');
        if (!fs.existsSync(assetsPath))
            return;
        Object.values(MemeCategory).forEach(category => {
            const categoryDir = category.toLowerCase().replace(/\s/g, '');
            const categoryPath = path.join(assetsPath, categoryDir);
            if (fs.existsSync(categoryPath)) {
                const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.mp3'));
                if (files.length > 0) {
                    this.localAssets.set(category, files.map(f => path.join(categoryPath, f)));
                }
            }
        });
    }
    async play(category, force = false) {
        if (this.isPlaying && !force)
            return;
        const config = vscode.workspace.getConfiguration('malayalamMemes');
        if (!config.get('enabled'))
            return;
        // Points penalty for errors
        if (category === MemeCategory.TerminalError || category === MemeCategory.ProjectError) {
            this.stats.devPoints = Math.max(0, this.stats.devPoints - 50);
            this.stats.mood = 'Frustrated';
        }
        else if (category === MemeCategory.Success) {
            this.stats.devPoints += 100;
        }
        if (!force) {
            const now = Date.now();
            const cooldown = (config.get('cooldown') || 10) * 1000;
            if (now - this.lastPlayedTime < cooldown)
                return;
        }
        const localItems = this.localAssets.get(category) || [];
        const remoteItems = this.remoteAssets.get(category) || [];
        const pool = [...localItems];
        if (config.get('sourcePreference') === 'hybrid') {
            pool.push(...remoteItems);
        }
        if (pool.length === 0)
            return;
        const selected = pool[Math.floor(Math.random() * pool.length)];
        this.lastPlayedTime = Date.now();
        this.isPlaying = true;
        this.playbackTimeout = setTimeout(() => { this.isPlaying = false; }, 15000);
        // Update stats
        this.stats.totalPlayed++;
        this.stats.categoryCounts[category] = (this.stats.categoryCounts[category] || 0) + 1;
        this.stats.lastCategory = category;
        const dialogues = MEME_DIALOGUES[category] || [];
        const dialogue = dialogues[Math.floor(Math.random() * dialogues.length)] || category;
        // Force Jacky mood if starting Jacky
        if (category === MemeCategory.Startup && selected.includes('jacky')) {
            this.stats.mood = 'Jacky Entry';
        }
        this._onDidPlay.fire({ category, dialogue, stats: this.stats });
        this._onStatsUpdate.fire(this.stats);
        if (config.get('showNotifications') !== false) {
            vscode.window.showInformationMessage(dialogue);
        }
        await this.executePlayback(selected, category, config);
    }
    async executePlayback(selected, category, config) {
        try {
            const volume = config.get('volume') ?? 0.5;
            await soundPlayer.play(selected, volume);
        }
        catch (error) {
            console.error(`[Malayalam Memes] Error:`, error);
        }
        finally {
            this.isPlaying = false;
            if (this.playbackTimeout)
                clearTimeout(this.playbackTimeout);
        }
    }
}
exports.MemeManager = MemeManager;
const MEME_DIALOGUES = {
    [MemeCategory.Startup]: ['🎬 "Ivideyum undallo nammade aal!" — VS Code is ready!', '🔥 "Kali thudangi!" — Let the coding begin!'],
    [MemeCategory.FolderOpen]: ['📂 "Ivide oru puthiya lokam!"'],
    [MemeCategory.Inactivity]: ['😴 "Mone... urangalle, code ezhuthane!"', '⏰ "Pani edada pani!"'],
    [MemeCategory.TerminalError]: ['💥 "Pattiyalla! Njan porunne!"'],
    [MemeCategory.ProjectError]: ['🐛 "Ee bug ente veedu polikkum!"', '⚠️ "Sheriyaakkada mone!"'],
    [MemeCategory.DeepWork]: ['🧠 "Mass aanu machane! Full power!"'],
    [MemeCategory.Success]: ['✅ "Thankyou! Nannaayi!"', '🎉 "Kidu! Ellam shariyaayi!"'],
    [MemeCategory.GitPush]: ['🚀 "Push cheythu! Full success!"'],
    [MemeCategory.Shutdown]: ['🚪 "Enna njan angotu...!", "🏃‍♂️ "Pinne kaanam machane! Bye!"']
};
//# sourceMappingURL=memeManager.js.map