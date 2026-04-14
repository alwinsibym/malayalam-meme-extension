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
let pointsDecorationType;
function activate(context) {
    const memeManager = memeManager_1.MemeManager.getInstance(context);
    pointsDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 2em',
            textDecoration: 'none; font-weight: bold; color: #fbbf24; font-size: 0.9em; position: absolute;',
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });
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
            const added = e.contentChanges[0].text.length;
            charCount += added;
            resetInactivityTimer(context);
            const editor = vscode.window.activeTextEditor;
            if (editor && added > 0 && added < 10) { // Only for typing, not copy-paste
                const points = Math.floor(added / 2) + 1;
                showPointsPopup(editor, points);
            }
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
    // 8. Toggle Pet
    context.subscriptions.push(vscode.commands.registerCommand('malayalamMemes.togglePet', async () => {
        const config = vscode.workspace.getConfiguration('malayalamMemes');
        await config.update('showPet', !config.get('showPet'), vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Pixel Pet is now ${config.get('showPet') ? 'ALIVE! 🐾' : 'RESTING. 😴'}`);
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
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            const config = vscode.workspace.getConfiguration('malayalamMemes');
            const companion = (config.get('selectedCompanion') || 'Jacky').toLowerCase();
            if (msg.command === 'petClick' || msg.command === 'autoTalk') {
                const dialogues = memeManager_1.COMPANION_DIALOGUES[companion] || [];
                const text = dialogues[Math.floor(Math.random() * dialogues.length)];
                // Inform webview to show bubble
                webviewView.webview.postMessage({ command: 'showSpeech', text });
                // Play random meme sound with cooldown (not forced)
                this._memeManager.play(Math.random() > 0.5 ? memeManager_1.MemeCategory.Success : memeManager_1.MemeCategory.Startup);
            }
        });
        this.updateWebview(true);
        // Refresh when config changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('malayalamMemes'))
                this.updateWebview(true);
        });
    }
    updateWebview(forceReload = false) {
        if (!this._view)
            return;
        if (forceReload || !this._isHtmlSet) {
            this._view.webview.html = this._getHtml(this._memeManager.getStats());
            this._isHtmlSet = true;
            return;
        }
        // Just update existing DOM instead of reloading the webview to prevent reloading scripts
        const stats = this._memeManager.getStats();
        const config = vscode.workspace.getConfiguration('malayalamMemes');
        let gifUri = '';
        if (config.get('showVisuals')) {
            const categoryKey = (stats.lastCategory || 'startup').toLowerCase().replace(/\s/g, '');
            const visualsDir = path.join(this._extensionUri.fsPath, 'assets', 'visuals', categoryKey);
            let gifFile = 'default.gif';
            try {
                if (fs.existsSync(visualsDir)) {
                    const files = fs.readdirSync(visualsDir).filter(f => f.endsWith('.gif'));
                    if (files.length > 0)
                        gifFile = files[Math.floor(Math.random() * files.length)];
                }
            }
            catch { /* ignore */ }
            gifUri = this._view.webview.asWebviewUri(vscode.Uri.file(path.join(visualsDir, gifFile))).toString();
        }
        this._view.webview.postMessage({
            command: 'updateStats',
            stats,
            gifUri,
            color: this._getMoodColor(stats.mood)
        });
    }
    _isHtmlSet = false;
    _getMoodColor(mood) {
        const moodColors = { 'Mass': '#facc15', 'God Mode': '#f472b6', 'Frustrated': '#f87171', 'Focus': '#38bdf8', 'Idle': '#94a3b8', 'Jacky Entry': '#fbbf24' };
        return moodColors[mood] || '#38bdf8';
    }
    _getHtml(stats) {
        const config = vscode.workspace.getConfiguration('malayalamMemes');
        const showVisuals = config.get('showVisuals');
        const showPet = config.get('showPet');
        const companion = (config.get('selectedCompanion') || 'Jacky').toLowerCase();
        const movement = config.get('companionMovement') || 'Autonomous';
        const color = this._getMoodColor(stats.mood);
        let gifUri = '';
        if (showVisuals) {
            const categoryKey = (stats.lastCategory || 'startup').toLowerCase().replace(/\s/g, '');
            const visualsDir = path.join(this._extensionUri.fsPath, 'assets', 'visuals', categoryKey);
            let gifFile = 'default.gif';
            try {
                if (fs.existsSync(visualsDir)) {
                    const files = fs.readdirSync(visualsDir).filter(f => f.endsWith('.gif'));
                    if (files.length > 0)
                        gifFile = files[Math.floor(Math.random() * files.length)];
                }
            }
            catch { /* ignore */ }
            gifUri = this._view.webview.asWebviewUri(vscode.Uri.file(path.join(visualsDir, gifFile))).toString();
        }
        const companionUri = this._view.webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'assets', 'companions', `${companion}.png`))).toString();
        return `<!DOCTYPE html><html><head><style>
            body { font-family: sans-serif; padding: 15px; background: #0f172a; color: white; display:flex; flex-direction:column; gap:15px; user-select: none; }
            .mood-badge { background: ${color}; color: black; padding: 10px; border-radius: 20px; font-weight: 800; text-align: center; text-transform: uppercase; box-shadow: 0 0 15px ${color}44; transition: all 0.3s; }
            .visual-container { width: 100%; aspect-ratio: 4/3; background: #1e293b; border-radius: 12px; overflow: hidden; border: 2px solid ${color}33; display: ${showVisuals ? 'flex' : 'none'}; align-items:center; justify-content:center; position: relative; }
            .visual-container img { width: 100%; height: 100%; object-fit: cover; }
            
            .companion-world { 
                width: 100%; height: 200px; position: relative; border-radius: 12px; 
                background: linear-gradient(to bottom, #1e293b, #0f172a); 
                display: ${showPet ? 'block' : 'none'}; cursor: grab; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);
            }
            .companion { 
                position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); 
                width: 64px; image-rendering: pixelated; transition: left 2s ease-in-out, transform 0.2s;
                z-index: 10;
            }
            .bubble {
                position: absolute; background: white; color: black; padding: 8px 12px; border-radius: 12px;
                font-size: 11px; font-weight: bold; bottom: 90px; left: 50%; transform: translateX(-50%);
                white-space: nowrap; visibility: hidden; opacity: 0; transition: opacity 0.3s; z-index: 20;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            }
            .bubble::after { content: ''; position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid white; }
            
            .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .card { background: #1e293b; padding: 10px; border-radius: 8px; border-left: 3px solid ${color}; }
            .val { font-size: 1.4em; font-weight: bold; color: ${color}; }
            .lab { font-size: 0.7em; color: #94a3b8; }
            .rank { padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; font-weight: bold; border: 1px solid rgba(255,255,255,0.05); }
        </style></head><body>
        </style></head><body>
            <div class="mood-badge" id="mood-badge">${stats.mood}</div>
            <div class="visual-container" id="visual-container"><img id="visual-img" src="${gifUri}" onerror="this.src='https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJidWtwN2N3eGN4eGN4eGN4eGN4eGN4eGN4eGN4eGN4eGN4eGN4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxGZfVjVIdy/giphy.gif';" /></div>
            
            <div class="companion-world" id="world">
                <div class="bubble" id="bubble">...</div>
                <img src="${companionUri}" class="companion" id="companion" />
            </div>

            <div class="stats"><div class="card"><div class="val" id="dev-points">${stats.devPoints}</div><div class="lab">POINTS</div></div><div class="card"><div class="val" id="wpm">${stats.wpm}</div><div class="lab">WPM</div></div></div>
            <div class="rank" id="rank">🏅 ${stats.rank}</div>

            <script>
                const vscode = acquireVsCodeApi();
                const companion = document.getElementById('companion');
                const world = document.getElementById('world');
                const bubble = document.getElementById('bubble');
                
                const MOVEMENT = "${movement}";
                let currentX = world.clientWidth / 2;
                let targetX = currentX;
                let isMoving = false;
                
                function showSpeech(text) {
                    bubble.innerText = text;
                    bubble.style.visibility = 'visible';
                    bubble.style.opacity = '1';
                    bubble.style.left = companion.style.left;
                    setTimeout(() => { bubble.style.opacity = '0'; }, 3000);
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'showSpeech') {
                        showSpeech(message.text);
                    } else if (message.command === 'updateStats') {
                        document.getElementById('mood-badge').innerText = message.stats.mood;
                        document.getElementById('mood-badge').style.background = message.color;
                        document.getElementById('mood-badge').style.boxShadow = \`0 0 15px \${message.color}44\`;
                        document.getElementById('dev-points').innerText = message.stats.devPoints;
                        document.getElementById('dev-points').style.color = message.color;
                        document.getElementById('wpm').innerText = message.stats.wpm;
                        document.getElementById('wpm').style.color = message.color;
                        document.getElementById('rank').innerText = '🏅 ' + message.stats.rank;
                        if (message.gifUri && message.gifUri !== '') {
                            document.getElementById('visual-img').src = message.gifUri;
                        }
                    }
                });

                companion.onclick = () => {
                    companion.style.transform = 'translateX(-50%) scale(1.3)';
                    setTimeout(() => {
                         companion.style.transform = companion.dataset.dir === 'left' ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)';
                    }, 200);
                    vscode.postMessage({ command: 'petClick' });
                };

                // Advanced Autonomous Brain
                function brainLoop() {
                    if (MOVEMENT !== 'Autonomous') return;

                    const decision = Math.random();
                    
                    if (decision > 0.6) { // Decided to Walk
                        targetX = Math.random() * (world.clientWidth - 80) + 40;
                        const direction = targetX > currentX ? 'right' : 'left';
                        
                        // Face the direction
                        companion.dataset.dir = direction;
                        companion.style.transform = direction === 'left' ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)';
                        
                        // Dynamic duration based on distance
                        const distance = Math.abs(targetX - currentX);
                        const duration = distance * (10 + Math.random() * 20); // variable speed
                        
                        companion.style.transition = \`left \${duration}ms ease-in-out\`;
                        companion.style.left = targetX + 'px';
                        currentX = targetX;
                        
                        setTimeout(brainLoop, duration + 500 + Math.random() * 2000);
                    } else if (decision > 0.4) { // Decided to Talk
                        vscode.postMessage({ command: 'autoTalk' });
                        setTimeout(brainLoop, 3000 + Math.random() * 2000);
                    } else { // Just Chilling
                        companion.style.animation = 'idle 1s infinite alternate ease-in-out';
                        setTimeout(brainLoop, 2000 + Math.random() * 3000);
                    }
                }

                if (MOVEMENT === 'Autonomous') {
                    brainLoop();
                } else if (MOVEMENT === 'Idle') {
                    companion.style.animation = 'idle 1s infinite alternate ease-in-out';
                }

                // Dragging resets brain temporarily
                let isDragging = false;
                companion.onmousedown = (e) => { isDragging = true; companion.style.transition = 'none'; };
                document.onmouseup = () => { 
                    isDragging = false; 
                    const rect = companion.getBoundingClientRect();
                    currentX = rect.left + rect.width / 2;
                };
                world.onmousemove = (e) => {
                    if (isDragging) {
                        const rect = world.getBoundingClientRect();
                        const x = Math.max(30, Math.min(rect.width - 30, e.clientX - rect.left));
                        companion.style.left = x + 'px';
                        currentX = x;
                    }
                };
            </script>
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
async function showPointsPopup(editor, points) {
    const position = editor.selection.active;
    const range = new vscode.Range(position, position);
    editor.setDecorations(pointsDecorationType, [{
            range: range,
            renderOptions: {
                after: {
                    contentText: `+${points} pts 🔥`
                }
            }
        }]);
    // Clear after a short delay to simulate an animation/popup
    setTimeout(() => {
        if (vscode.window.activeTextEditor === editor) {
            editor.setDecorations(pointsDecorationType, []);
        }
    }, 600);
}
//# sourceMappingURL=extension.js.map