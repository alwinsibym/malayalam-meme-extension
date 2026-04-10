import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import axios from 'axios';
import * as soundPlayer from 'sound-play';
// @ts-ignore
import isOnline from 'is-online';

export enum MemeCategory {
    Startup = 'Startup',
    FolderOpen = 'FolderOpen',
    Inactivity = 'Inactivity',
    TerminalError = 'TerminalError',
    ProjectError = 'ProjectError',
    DeepWork = 'DeepWork',
    Success = 'Success',
    GitPush = 'GitPush'
}

export type DeveloperMood = 'Focus' | 'Frustrated' | 'Mass' | 'Idle' | 'God Mode' | 'Jacky Entry';

export interface MemeStats {
    totalPlayed: number;
    categoryCounts: Record<string, number>;
    sessionStart: number;
    lastCategory: string;
    favoriteCategory: string;
    // Gamification
    devPoints: number;
    wpm: number;
    rank: string;
    mood: DeveloperMood;
}

export class MemeManager {
    private static instance: MemeManager;
    private localAssets: Map<MemeCategory, string[]> = new Map();
    private remoteAssets: Map<MemeCategory, string[]> = new Map();
    private cacheDir: string;
    private lastPlayedTime: number = 0;
    private isPlaying: boolean = false;
    private playbackTimeout: NodeJS.Timeout | undefined;

    // Session stats & Gamification
    private stats: MemeStats = {
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

    private _onDidPlay = new vscode.EventEmitter<{ category: MemeCategory; dialogue: string; stats: MemeStats }>();
    public readonly onDidPlay = this._onDidPlay.event;

    private _onStatsUpdate = new vscode.EventEmitter<MemeStats>();
    public readonly onStatsUpdate = this._onStatsUpdate.event;

    private constructor(private context: vscode.ExtensionContext) {
        this.cacheDir = path.join(os.tmpdir(), 'malayalam-memes-cache');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        this.initializeLocalAssets();
    }

    public static getInstance(context: vscode.ExtensionContext): MemeManager {
        if (!MemeManager.instance) {
            MemeManager.instance = new MemeManager(context);
        }
        return MemeManager.instance;
    }

    public getStats(): MemeStats {
        return { ...this.stats };
    }

    /** Updates WPM and adds points */
    public updateActivity(charsTyped: number, currentWpm: number) {
        this.stats.wpm = currentWpm;
        this.stats.devPoints += Math.floor(charsTyped / 10);
        this.updateMoodAndRank();
        this._onStatsUpdate.fire(this.stats);
    }

    private updateMoodAndRank() {
        // Mood Logic
        if (this.stats.wpm > 60) this.stats.mood = 'Mass';
        else if (this.stats.wpm > 100) this.stats.mood = 'God Mode';
        else if (this.stats.wpm < 5 && this.stats.totalPlayed > 0) this.stats.mood = 'Idle';
        
        // Ranking Logic
        if (this.stats.devPoints > 10000) this.stats.rank = 'Sagar Alias Jacky';
        else if (this.stats.devPoints > 5000) this.stats.rank = 'Legendary Coder';
        else if (this.stats.devPoints > 2000) this.stats.rank = 'Senior Dev';
        else if (this.stats.devPoints > 500) this.stats.rank = 'Mid-Level Dev';
    }

    private initializeLocalAssets() {
        const assetsPath = path.join(this.context.extensionPath, 'assets');
        if (!fs.existsSync(assetsPath)) return;

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

    public async play(category: MemeCategory, force: boolean = false) {
        if (this.isPlaying) return;

        const config = vscode.workspace.getConfiguration('malayalamMemes');
        if (!config.get('enabled')) return;

        // Points penalty for errors
        if (category === MemeCategory.TerminalError || category === MemeCategory.ProjectError) {
            this.stats.devPoints = Math.max(0, this.stats.devPoints - 50);
            this.stats.mood = 'Frustrated';
        } else if (category === MemeCategory.Success) {
            this.stats.devPoints += 100;
        }

        if (!force) {
            const now = Date.now();
            const cooldown = (config.get<number>('cooldown') || 10) * 1000;
            if (now - this.lastPlayedTime < cooldown) return;
        }

        const localItems = this.localAssets.get(category) || [];
        const remoteItems = this.remoteAssets.get(category) || [];
        const pool: string[] = [...localItems];

        if (config.get('sourcePreference') === 'hybrid') {
            pool.push(...remoteItems);
        }

        if (pool.length === 0) return;

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

    private async executePlayback(selected: string, category: MemeCategory, config: vscode.WorkspaceConfiguration) {
        try {
            const volume = config.get<number>('volume') ?? 0.5;
            await soundPlayer.play(selected, volume);
        } catch (error) {
            console.error(`[Malayalam Memes] Error:`, error);
        } finally {
            this.isPlaying = false;
            if (this.playbackTimeout) clearTimeout(this.playbackTimeout);
        }
    }
}

const MEME_DIALOGUES: Record<MemeCategory, string[]> = {
    [MemeCategory.Startup]: ['🎬 "Ivideyum undallo nammade aal!" — VS Code is ready!', '🔥 "Kali thudangi!" — Let the coding begin!'],
    [MemeCategory.FolderOpen]: ['📂 "Ivide oru puthiya lokam!"'],
    [MemeCategory.Inactivity]: ['😴 "Mone... urangalle, code ezhuthane!"', '⏰ "Pani edada pani!"'],
    [MemeCategory.TerminalError]: ['💥 "Pattiyalla! Njan porunne!"'],
    [MemeCategory.ProjectError]: ['🐛 "Ee bug ente veedu polikkum!"', '⚠️ "Sheriyaakkada mone!"'],
    [MemeCategory.DeepWork]: ['🧠 "Mass aanu machane! Full power!"'],
    [MemeCategory.Success]: ['✅ "Thankyou! Nannaayi!"', '🎉 "Kidu! Ellam shariyaayi!"'],
    [MemeCategory.GitPush]: ['🚀 "Push cheythu! Full success!"']
};
