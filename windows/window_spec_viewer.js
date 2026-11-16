/**
 * Mekong Sense REMOTE SENSING DATA PORTAL — ENGINEERING SPECIFICATION VIEWER
 * Dedicated workbench for Validated / Planned Data Branches (B04 - B13).
 * Adheres strictly to taste-skill data-terminal design tokens.
 */

import { BranchWindowV2 } from '../core/window_interface.js';

export class WindowSpecViewer extends BranchWindowV2 {
    async _onMount(containerElement, signal, initialState) {
        const b = this.manifest;

        containerElement.className = 'workbench-window-shell flex flex-col h-full bg-[#131217] overflow-y-auto p-6';
        containerElement.innerHTML = `
            <!-- Top Architecture Header -->
            <div class="flex items-center justify-between border-b border-[#222224] pb-4 mb-6">
                <div class="flex items-center space-x-3">
                    <span class="text-sm font-mono px-2 py-1 rounded font-bold" style="background: rgba(255,255,255,0.06); color: ${b.color};">
                        ${b.code}
                    </span>
                    <div>
                        <h2 class="text-base font-bold text-white tracking-wide">${b.title}</h2>
                        <div class="text-xs text-slate-400 font-mono mt-0.5">${b.summary}</div>
                    </div>
                </div>

                <div class="flex items-center space-x-3">
                    <span class="text-xs font-mono px-2 py-0.5 rounded border" style="background: #1b241e; color: #4ade80; border-color: #24462e;">
                        ${b.statusLabel || b.status}
                    </span>
                    <span class="text-xs font-mono text-slate-400 border border-[#222224] px-2 py-0.5 rounded">
                        Cadence: ${b.temporalResolution}
                    </span>
                </div>
            </div>

            <!-- 3-Pillar Technical Specification Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <!-- Pillar 1: Sensor Ingestion -->
                <div class="bg-[#171719] border border-[#222224] rounded p-4 flex flex-col justify-between">
                    <div>
                        <div class="text-xs font-mono text-slate-400 mb-2 font-bold tracking-wider">PILLAR 1: SENSOR INGESTION</div>
                        <ul class="space-y-1.5 text-xs text-slate-200">
                            ${b.primarySensors.map(s => `
                                <li class="flex items-center space-x-2">
                                    <span class="w-1.5 h-1.5 rounded-full" style="background: ${b.color};"></span>
                                    <span>${s}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    <div class="mt-4 pt-3 border-t border-[#222224] text-[11px] text-slate-400 font-mono">
                        Pipeline: Central Ingestor -> Spatial Gate
                    </div>
                </div>

                <!-- Pillar 2: Core Algorithmic Engine -->
                <div class="bg-[#171719] border border-[#222224] rounded p-4 flex flex-col justify-between">
                    <div>
                        <div class="text-xs font-mono text-slate-400 mb-2 font-bold tracking-wider">PILLAR 2: GOVERNING PHYSICAL ENGINE</div>
                        <div class="text-xs text-slate-200 leading-relaxed font-mono">
                            ${b.coreEngine}
                        </div>
                    </div>
                    <div class="mt-4 pt-3 border-t border-[#222224] text-[11px] text-sky-400 font-mono">
                        Zero-Trust Quality Verification Gate
                    </div>
                </div>

                <!-- Pillar 3: Downstream Model Exports -->
                <div class="bg-[#171719] border border-[#222224] rounded p-4 flex flex-col justify-between">
                    <div>
                        <div class="text-xs font-mono text-slate-400 mb-2 font-bold tracking-wider">PILLAR 3: MODEL BOUNDARY EXPORTS</div>
                        <div class="flex flex-wrap gap-1.5">
                            ${b.supportedExports.map(exp => `
                                <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-[#212023] border border-[#333338] text-slate-300">
                                    ${exp}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    <div class="mt-4 pt-3 border-t border-[#222224] text-[11px] text-slate-400 font-mono">
                        Automated Boundary Exporter (ASCII / Parquet)
                    </div>
                </div>
            </div>

            <!-- Pipeline Blueprint & Specification Manifest Card -->
            <div class="bg-[#171719] border border-[#222224] rounded p-5 flex-1 flex flex-col">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-xs font-mono font-bold text-slate-300">BRANCH ARCHITECTURAL MANIFEST (JSON SPECIFICATION)</span>
                    <button id="btnCopyManifest" class="text-xs font-mono px-2.5 py-1 rounded bg-[#212023] hover:bg-[#2c2b30] border border-[#333338] text-sky-400">
                        Copy Manifest
                    </button>
                </div>

                <pre class="bg-[#100f13] border border-[#222224] rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto flex-1">${JSON.stringify(b, null, 2)}</pre>
            </div>
        `;

        const copyBtn = containerElement.querySelector('#btnCopyManifest');
        if (copyBtn) {
            this.addManagedEventListener(copyBtn, 'click', async () => {
                const jsonStr = JSON.stringify(b, null, 2);
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(jsonStr);
                    }
                } catch (e) {
                    // Fallback ignored in headless
                }
                copyBtn.innerText = 'COPIED JSON';
                copyBtn.classList.add('text-emerald-400');
                setTimeout(() => {
                    if (copyBtn) {
                        copyBtn.innerText = 'Copy Manifest';
                        copyBtn.classList.remove('text-emerald-400');
                    }
                }, 1500);
            });
        }
    }

    getTelemetrySummary() {
        return [
            { label: 'BRANCH', value: this.manifest.code, color: this.manifest.color },
            { label: 'STATUS', value: this.manifest.status, color: '#4ade80' },
            { label: 'CADENCE', value: this.manifest.temporalResolution, color: '#94a3b8' }
        ];
    }
}

export default WindowSpecViewer;
