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
exports.ControlPanelWebview = void 0;
const vscode = __importStar(require("vscode"));
const memeManager_1 = require("./memeManager");
class ControlPanelWebview {
    memeManager;
    static currentPanel;
    _panel;
    _extensionUri;
    _disposables = [];
    static createOrShow(extensionUri, memeManager) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (ControlPanelWebview.currentPanel) {
            ControlPanelWebview.currentPanel._panel.reveal(column);
            ControlPanelWebview.currentPanel.updateHtml();
            return;
        }
        const panel = vscode.window.createWebviewPanel('malayalamMemesControlPanel', 'Malayalam Memes Control Panel', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [extensionUri]
        });
        ControlPanelWebview.currentPanel = new ControlPanelWebview(panel, extensionUri, memeManager);
    }
    constructor(panel, extensionUri, memeManager) {
        this.memeManager = memeManager;
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.updateHtml();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            const config = vscode.workspace.getConfiguration('malayalamMemes');
            switch (message.command) {
                case 'toggleExtension':
                    await config.update('enabled', message.value, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Malayalam Memes is now ${message.value ? 'ENABLED' : 'DISABLED'}`);
                    break;
                case 'setVolume':
                    await config.update('volume', message.value, vscode.ConfigurationTarget.Global);
                    break;
                case 'setMode':
                    await config.update('intensityMode', message.value, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Mode set to ${message.value}`);
                    break;
                case 'togglePet':
                    await config.update('showPet', message.value, vscode.ConfigurationTarget.Global);
                    break;
                case 'toggleVisuals':
                    await config.update('showVisuals', message.value, vscode.ConfigurationTarget.Global);
                    break;
                case 'playRandom':
                    this.memeManager.play(Object.values(memeManager_1.MemeCategory)[Math.floor(Math.random() * 8)], true);
                    break;
                case 'jacky':
                    vscode.commands.executeCommand('malayalamMemes.sagarAliasJacky');
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'malayalamMemes');
                    break;
            }
            // Refresh UI after config changes
            this.updateHtml();
        }, null, this._disposables);
        // Also refresh when config changes externally
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('malayalamMemes')) {
                this.updateHtml();
            }
        });
    }
    updateHtml() {
        this._panel.webview.html = this.getHtml();
    }
    dispose() {
        ControlPanelWebview.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    getHtml() {
        const config = vscode.workspace.getConfiguration('malayalamMemes');
        const isEnabled = config.get('enabled') ?? true;
        const volume = config.get('volume') ?? 0.5;
        const currentMode = config.get('intensityMode') ?? 'Balanced';
        const showPet = config.get('showPet') ?? true;
        const showVisuals = config.get('showVisuals') ?? true;
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Control Panel</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    color: #fff;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .glass-panel {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 40px;
                    width: 450px;
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
                }
                h1 {
                    text-align: center;
                    font-size: 24px;
                    margin-bottom: 30px;
                    background: linear-gradient(90deg, #38bdf8, #818cf8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .control-group {
                    margin-bottom: 25px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .control-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #cbd5e1;
                }
                /* Toggles */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider {
                    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                    background-color: rgba(255, 255, 255, 0.1); transition: .4s; border-radius: 24px;
                }
                .slider:before {
                    position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
                    background-color: white; transition: .4s; border-radius: 50%;
                }
                input:checked + .slider { background-color: #38bdf8; }
                input:checked + .slider:before { transform: translateX(20px); }

                /* Select & Inputs */
                select, input[type=range] {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    outline: none;
                }
                select option {
                    background: #1e293b;
                }
                input[type=range] {
                    width: 150px;
                    accent-color: #38bdf8;
                }
                
                /* Buttons */
                .button-row {
                    display: flex;
                    gap: 10px;
                    margin-top: 30px;
                }
                button {
                    flex: 1;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-weight: bold;
                }
                button:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: #38bdf8;
                }
                .btn-primary {
                    background: linear-gradient(90deg, #38bdf8, #818cf8);
                    border: none;
                }
                .btn-primary:hover {
                    opacity: 0.9;
                }
            </style>
        </head>
        <body>
            <div class="glass-panel">
                <h1>Malayalam Memes Control Panel</h1>
                
                <div class="control-group">
                    <div class="control-row">
                        <label>Enable Extension</label>
                        <label class="switch">
                            <input type="checkbox" id="toggleExt" ${isEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>

                <div class="control-group">
                    <div class="control-row">
                        <label>Intensity Mode</label>
                        <select id="modeSelect">
                            <option value="Balanced" ${currentMode === 'Balanced' ? 'selected' : ''}>Balanced</option>
                            <option value="Aggressive" ${currentMode === 'Aggressive' ? 'selected' : ''}>Aggressive (Deep Work)</option>
                            <option value="Chill" ${currentMode === 'Chill' ? 'selected' : ''}>Chill</option>
                            <option value="Do Not Disturb" ${currentMode === 'Do Not Disturb' ? 'selected' : ''}>Do Not Disturb</option>
                        </select>
                    </div>
                </div>

                <div class="control-group">
                    <div class="control-row">
                        <label>Volume: <span id="volLabel">${Math.round(volume * 100)}%</span></label>
                        <input type="range" id="volumeSlider" min="0" max="1" step="0.05" value="${volume}">
                    </div>
                </div>

                <div class="control-group">
                    <div class="control-row">
                        <label>Show Pixel Pet Companion</label>
                        <label class="switch">
                            <input type="checkbox" id="togglePet" ${showPet ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>

                <div class="control-group">
                    <div class="control-row">
                        <label>Show Meme Visuals (GIFs)</label>
                        <label class="switch">
                            <input type="checkbox" id="toggleVisuals" ${showVisuals ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>

                <div class="button-row">
                    <button id="btnRandom">🎲 Random Meme</button>
                    <button class="btn-primary" id="btnJacky">⚡ Sagar Alias Jacky</button>
                </div>
                <div class="button-row" style="margin-top: 10px;">
                    <button id="btnSettings">⚙️ Open JSON Settings</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('toggleExt').addEventListener('change', (e) => {
                    vscode.postMessage({ command: 'toggleExtension', value: e.target.checked });
                });
                
                document.getElementById('modeSelect').addEventListener('change', (e) => {
                    vscode.postMessage({ command: 'setMode', value: e.target.value });
                });
                
                const volSlider = document.getElementById('volumeSlider');
                const volLabel = document.getElementById('volLabel');
                volSlider.addEventListener('input', (e) => {
                    volLabel.innerText = Math.round(e.target.value * 100) + '%';
                });
                volSlider.addEventListener('change', (e) => {
                    vscode.postMessage({ command: 'setVolume', value: parseFloat(e.target.value) });
                });

                document.getElementById('togglePet').addEventListener('change', (e) => {
                    vscode.postMessage({ command: 'togglePet', value: e.target.checked });
                });
                
                document.getElementById('toggleVisuals').addEventListener('change', (e) => {
                    vscode.postMessage({ command: 'toggleVisuals', value: e.target.checked });
                });

                document.getElementById('btnRandom').addEventListener('click', () => {
                    vscode.postMessage({ command: 'playRandom' });
                });

                document.getElementById('btnJacky').addEventListener('click', () => {
                    vscode.postMessage({ command: 'jacky' });
                });
                
                document.getElementById('btnSettings').addEventListener('click', () => {
                    vscode.postMessage({ command: 'openSettings' });
                });
            </script>
        </body>
        </html>`;
    }
}
exports.ControlPanelWebview = ControlPanelWebview;
//# sourceMappingURL=controlPanelWebview.js.map