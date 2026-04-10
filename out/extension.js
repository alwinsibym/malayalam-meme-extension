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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const memeManager_1 = require("./memeManager");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let idleTimer;
let wpmTimer;
let charCount = 0;
let lastUpdate = Date.now();
let statusItem;
let volumeItem;
function activate(context) {
    const memeManager = memeManager_1.MemeManager.getInstance(context);
    // ── Status Bar Setup ─────────────────────────────────────────────
    statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusItem.command = 'malayalamMemes.controlPanel';
    updateStatusBar();
    statusItem.show();
    volumeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    volumeItem.command = 'malayalamMemes.setVolume';
    updateVolumeBar();
    volumeItem.show();
    context.subscriptions.push(statusItem, volumeItem);
    // ── Register Sidebar ─────────────────────────────────────────────
    const sidebarProvider = new MemeSidebarProvider(context.extensionUri, memeManager);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('malayalamMemes.sidebar', sidebarProvider));
    // ── Typing & WPM Tracking ────────────────────────────────────────
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length > 0) {
            charCount += e.contentChanges[0].text.length;
            resetInactivityTimer(context);
        }
    }));
    wpmTimer = setInterval(() => {
        const now = Date.now();
        const deltaMin = (now - lastUpdate) / 60000;
        const currentWpm = deltaMin > 0 ? Math.floor((charCount / 5) / deltaMin) : 0;
        memeManager.updateActivity(charCount, currentWpm);
        charCount = 0;
        lastUpdate = now;
    }, 5000);
    // ── Command Registrations ────────────────────────────────────────
    registerAllCommands(context, memeManager);
    // ── Event Triggers ───────────────────────────────────────────────
    // If we have a workspace, play FolderOpen, else play generic Startup
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        memeManager.play(memeManager_1.MemeCategory.FolderOpen);
    }
    else {
        memeManager.play(memeManager_1.MemeCategory.Startup);
    }
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((e) => {
        if (e.added.length > 0) {
            memeManager.play(memeManager_1.MemeCategory.FolderOpen, true);
        }
    }));
    setupInactivityTimer(context);
    if (vscode.window.onDidEndTerminalShellExecution) {
        context.subscriptions.push(vscode.window.onDidEndTerminalShellExecution(e => {
            if (e.exitCode === 0)
                memeManager.play(memeManager_1.MemeCategory.Success);
            else if (e.exitCode !== undefined)
                memeManager.play(memeManager_1.MemeCategory.TerminalError);
        }));
    }
    // Git Actions (Tasks)
    context.subscriptions.push(vscode.tasks.onDidEndTaskProcess((e) => {
        if (e.execution.task.name.toLowerCase().includes('push')) {
            memeManager.play(memeManager_1.MemeCategory.GitPush);
        }
    }));
    console.log('[Malayalam Memes] Fully restored and ready!');
}
function registerAllCommands(context, memeManager) {
    // 1. Control Panel
    context.subscriptions.push(vscode.commands.registerCommand('malayalamMemes.controlPanel', async () => {
        const config = vscode.workspace.getConfiguration('malayalamMemes');
        const isEnabled = config.get('enabled');
        const volume = config.get('volume') || 0.5;
        const items = [
            { label: `$(${isEnabled ? 'check' : 'close'}) Extension: ${isEnabled ? 'ON' : 'OFF'}`, action: 'toggle' },
            { label: `$(unmute) Volume: ${Math.round(volume * 100)}%`, action: 'volume' },
            { label: `$(play) Play Random Meme`, action: 'random' },
            { label: `$(library) Meme Gallery`, action: 'gallery' },
            { label: `$(graph) View Session Stats`, action: 'stats' },
            { label: `$(zap) SAGAR ALIAS JACKY!`, action: 'jacky' },
            { label: `$(settings-gear) Open Settings`, action: 'settings' }
        ];
        const picked = await vscode.window.showQuickPick(items, { title: '🎬 Malayalam Memes — Control Panel' });
        if (!picked)
            return;
        switch (picked.action) {
            case 'toggle':
                vscode.commands.executeCommand('malayalamMemes.toggle');
                break;
            case 'volume':
                vscode.commands.executeCommand('malayalamMemes.setVolume');
                break;
            case 'random':
                memeManager.play(Object.values(memeManager_1.MemeCategory)[Math.floor(Math.random() * 8)], true);
                break;
            case 'gallery':
                vscode.commands.executeCommand('malayalamMemes.showGallery');
                break;
            case 'stats':
                vscode.commands.executeCommand('malayalamMemes.showStats');
                break;
            case 'jacky':
                vscode.commands.executeCommand('malayalamMemes.sagarAliasJacky');
                break;
            case 'settings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'malayalamMemes');
                break;
        }
    }));
    // 2. Toggle
    context.subscriptions.push(vscode.commands.registerCommand('malayalamMemes.toggle', async () => {
        const config = vscode.workspace.getConfiguration('malayalamMemes');
        await config.update('enabled', !config.get('enabled'), vscode.ConfigurationTarget.Global);
        updateStatusBar();
        vscode.window.showInformationMessage(`Malayalam Memes is now ${config.get('enabled') ? 'ENABLED! 🔥' : 'DISABLED. 💤'}`);
    }));
    // 3. Set Volume
    context.subscriptions.push(vscode.commands.registerCommand('malayalamMemes.setVolume', async () => {
        const options = ['0%', '25%', '50%', '75%', '100%'];
        const picked = await vscode.window.showQuickPick(options, { title: '🔈 Adjust Meme Volume' });
        if (picked) {
            const vol = parseInt(picked) / 100;
            await vscode.workspace.getConfiguration('malayalamMemes').update('volume', vol, vscode.ConfigurationTarget.Global);
            updateVolumeBar();
        }
    }));
    // 4. Jacky
    context.subscriptions.push(vscode.commands.registerCommand('malayalamMemes.sagarAliasJacky', () => {
        vscode.window.showInformationMessage('🔥 "Sagar Alias Jacky... ORMAYUNDALLO!" 🔥');
        memeManager.play(memeManager_1.MemeCategory.Startup, true);
    }));
    // 5. Gallery
    context.subscriptions.push(vscode.commands.registerCommand('malayalamMemes.showGallery', async () => {
        const cats = Object.values(memeManager_1.MemeCategory).map(c => ({ label: c, value: c }));
        const picked = await vscode.window.showQuickPick(cats, { title: '🎵 Preview Memes' });
        if (picked)
            memeManager.play(picked.value, true);
    }));
    // 6. Stats (Webview)
    context.subscriptions.push(vscode.commands.registerCommand('malayalamMemes.showStats', () => {
        const panel = vscode.window.createWebviewPanel('memeStats', 'Malayalam Memes Stats', vscode.ViewColumn.One, { enableScripts: true });
        const uptime = Math.floor((Date.now() - memeManager.getStats().sessionStart) / 60000);
        panel.webview.html = getStatsHtml(memeManager.getStats(), uptime);
    }));
    // 7. Test Error
    context.subscriptions.push(vscode.commands.registerCommand('malayalamMemes.testTerminalError', () => {
        memeManager.play(memeManager_1.MemeCategory.TerminalError, true);
    }));
}
function updateStatusBar() {
    const enabled = vscode.workspace.getConfiguration('malayalamMemes').get('enabled');
    statusItem.text = enabled ? '$(check) Memes: ON' : '$(close) Memes: OFF';
    statusItem.color = enabled ? '#38bdf8' : '#94a3b8';
}
function updateVolumeBar() {
    const vol = vscode.workspace.getConfiguration('malayalamMemes').get('volume') || 0.5;
    volumeItem.text = `$(unmute) ${Math.round(vol * 100)}%`;
}
function setupInactivityTimer(context) {
    if (idleTimer)
        clearInterval(idleTimer);
    const timeout = (vscode.workspace.getConfiguration('malayalamMemes').get('inactivityTimeout') || 5) * 60000;
    idleTimer = setInterval(() => memeManager_1.MemeManager.getInstance(context).play(memeManager_1.MemeCategory.Inactivity), timeout);
}
function resetInactivityTimer(context) { setupInactivityTimer(context); }
// ══════════════════════════════════════════════════════════════════════
//  SIDEBAR PROVIDER
// ══════════════════════════════════════════════════════════════════════
class MemeSidebarProvider {
    _extensionUri;
    _memeManager;
    _view;
    constructor(_extensionUri, _memeManager) {
        this._extensionUri = _extensionUri;
        this._memeManager = _memeManager;
        _memeManager.onDidPlay(() => this.updateWebview());
        _memeManager.onStatsUpdate(() => this.updateWebview());
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        this.updateWebview();
    }
    updateWebview() {
        if (!this._view)
            return;
        this._view.webview.html = this._getHtml(this._memeManager.getStats());
    }
    _getHtml(stats) {
        const moodColors = { 'Mass': '#facc15', 'God Mode': '#f472b6', 'Frustrated': '#f87171', 'Focus': '#38bdf8', 'Idle': '#94a3b8', 'Jacky Entry': '#fbbf24' };
        const color = moodColors[stats.mood] || '#38bdf8';
        const categoryKey = (stats.lastCategory || 'startup').toLowerCase().replace(/\s/g, '');
        const visualsDir = path.join(this._extensionUri.fsPath, 'assets', 'visuals', categoryKey);
        let gifFile = 'default.gif';
        try {
            const files = fs.readdirSync(visualsDir).filter(f => f.endsWith('.gif'));
            if (files.length > 0)
                gifFile = files[Math.floor(Math.random() * files.length)];
        }
        catch { /* ignore */ }
        const gifUri = this._view.webview.asWebviewUri(vscode.Uri.file(path.join(visualsDir, gifFile)));
        return `<!DOCTYPE html><html><head><style>
            body { font-family: sans-serif; padding: 15px; background: #0f172a; color: white; display:flex; flex-direction:column; gap:15px; }
            .mood-badge { background: ${color}; color: black; padding: 10px; border-radius: 20px; font-weight: 800; text-align: center; text-transform: uppercase; box-shadow: 0 0 15px ${color}44; }
            .visual-container { width: 100%; aspect-ratio: 1/1; background: #1e293b; border-radius: 12px; overflow: hidden; border: 2px solid ${color}33; display: flex; align-items:center; justify-content:center; }
            .visual-container img { width: 100%; height: 100%; object-fit: cover; }
            .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .card { background: #1e293b; padding: 10px; border-radius: 8px; border-left: 3px solid ${color}; }
            .val { font-size: 1.4em; font-weight: bold; color: ${color}; }
            .lab { font-size: 0.7em; color: #94a3b8; }
            .rank { padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; font-weight: bold; border: 1px solid rgba(255,255,255,0.05); }
        </style></head><body>
            <div class="mood-badge">${stats.mood}</div>
            <div class="visual-container"><img src="${gifUri}" onerror="this.src='https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJidWtwN2N3eGN4eGN4eGN4eGN4eGN4eGN4eGN4eGN4eGN4eGN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxGZfVjVIdy/giphy.gif';" /></div>
            <div class="stats"><div class="card"><div class="val">${stats.devPoints}</div><div class="lab">POINTS</div></div><div class="card"><div class="val">${stats.wpm}</div><div class="lab">WPM</div></div></div>
            <div class="rank">🏅 ${stats.rank}</div>
        </body></html>`;
    }
}
function getStatsHtml(stats, uptime) {
    return `<!DOCTYPE html><html><body style="background:#0f172a; color:white; padding:40px; font-family:sans-serif;">
        <h1 style="color:#38bdf8">Meme Stats</h1>
        <p>Total Played: ${stats.totalPlayed}</p>
        <p>Current Rank: ${stats.rank}</p>
        <p>Session Uptime: ${uptime}m</p>
    </body></html>`;
}
function deactivate() {
    if (idleTimer)
        clearInterval(idleTimer);
    if (wpmTimer)
        clearInterval(wpmTimer);
    // We try to play the shutdown meme. Use getInstance with null as it's already initialized
    // or just use the local reference if we kept one.
    const memeManager = memeManager_1.MemeManager.getInstance(undefined);
    if (memeManager) {
        return memeManager.play(memeManager_1.MemeCategory.Shutdown, true);
    }
}
//# sourceMappingURL=extension.js.map