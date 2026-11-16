/**
 * Mekong Sense REMOTE SENSING DATA PORTAL — COMMAND PALETTE (Ctrl+K / ⌘K)
 * Fast keyboard-first switcher across 13 branches, cascade dams, and basin telemetry.
 * Conforms 100% to taste-skill data-terminal design tokens.
 */

export class CommandPalette {
    constructor(windowManager, registry) {
        this.wm = windowManager;
        this.registry = registry;
        this.isOpen = false;
        this.selectedIndex = 0;
        this.items = [];
        this.filteredItems = [];

        this._initCatalog();
        this._buildDom();
        this._bindShortcuts();
    }

    _initCatalog() {
        this.items = [];

        // 1. Add all 13 branches
        for (const branch of this.registry.branches) {
            const sensorsText = Array.isArray(branch.primarySensors) ? branch.primarySensors.slice(0, 2).join(' + ') : 'Multispectral';
            this.items.push({
                type: 'BRANCH',
                id: branch.id,
                code: branch.code,
                title: branch.title,
                subtitle: `${sensorsText} • ${branch.coreEngine}`,
                status: branch.status,
                color: branch.color || '#38bdf8',
                action: (slot) => this.wm.openBranch(branch.id, slot)
            });
        }

        // 2. Add Dam Shortcuts (B01)
        const damShortcuts = [
            { id: 'jinghong', name: 'Jinghong Dam', basin: 'Lancang Basin', country: 'CN', verified: true },
            { id: 'nuozhadu', name: 'Nuozhadu Dam', basin: 'Lancang Basin', country: 'CN', verified: true },
            { id: 'yali_falls', name: 'Ialy Falls (Yali) Dam', basin: 'Se San Basin', country: 'VN', verified: true },
            { id: 'xiaowan', name: 'Xiaowan Dam', basin: 'Lancang Basin', country: 'CN', verified: false },
            { id: 'nam_theun_2', name: 'Nam Theun 2 Dam', basin: 'Nam Theun Basin', country: 'LA', verified: false },
            { id: 'xayaburi', name: 'Xayaburi Run-of-River Dam', basin: 'Mekong Mainstream', country: 'LA', verified: false }
        ];

        for (const dam of damShortcuts) {
            this.items.push({
                type: 'DAM',
                id: dam.id,
                code: 'DAM',
                title: `${dam.name} [${dam.country}]`,
                subtitle: dam.verified
                    ? `${dam.basin} • Verified SOTA (SAR + ICESat-2 + Residual Solver)`
                    : `${dam.basin} • Calibration In Progress (Telemetry Gated)`,
                status: dam.verified ? 'VERIFIED SOTA' : 'CALIBRATING',
                color: dam.verified ? '#44a282' : '#d9a441',
                action: async (slot) => {
                    await this.wm.openBranch('branch_01_dams', slot);
                    const b01 = this.wm.mountedWindows.get('branch_01_dams');
                    if (b01 && typeof b01.selectDam === 'function') {
                        b01.selectDam(dam.id);
                    }
                }
            });
        }

        // 3. Add Basin Precipitation Shortcuts (B02)
        const basinShortcuts = [
            { id: 'chi_basin_thailand', code: 'CHI_BASIN', name: 'Chi River Basin (NE Thailand)', area: '49,133 km²' },
            { id: 'mun_basin_thailand', code: 'MUN_BASIN', name: 'Mun River Basin (NE Thailand)', area: '70,436 km²' },
            { id: 'tonle_sap_basin', code: 'TONLE_SAP', name: 'Tonle Sap Great Lake Basin (Cambodia)', area: '85,786 km²' },
            { id: 'upper_lancang', code: 'LANCANG_UPPER', name: 'Upper Lancang Headwaters (Tibetan Plateau)', area: '88,735 km²' },
            { id: 'sesan_basin_vn_kh', code: 'SE_SAN', name: 'Sesan River Basin (Central Highlands VN / KH)', area: '18,890 km²' },
            { id: 'mekong_delta_middle', code: 'MEKONG_DELTA', name: 'Mekong Delta Central Alluvial Plain', area: '53,510 km²' }
        ];

        for (const b of basinShortcuts) {
            this.items.push({
                type: 'BASIN',
                id: b.id,
                code: 'PRECIP',
                title: `${b.name} (${b.code})`,
                subtitle: `${b.area} • GPM IMERG V07B + ERA5-Land Fusion`,
                status: 'CALIBRATED',
                color: '#38bdf8',
                action: async (slot) => {
                    await this.wm.openBranch('branch_02_precipitation', slot);
                    const b02 = this.wm.mountedWindows.get('branch_02_precipitation');
                    if (b02 && typeof b02.selectBasin === 'function') {
                        b02.selectBasin(b.id);
                    }
                }
            });
        }

        // 4. Global Layout Commands
        this.items.push({
            type: 'COMMAND',
            id: 'cmd_toggle_split',
            code: 'VIEW',
            title: 'Toggle Split-View Workbench [Key: 2]',
            subtitle: 'Dual side-by-side synchronized hydro-telemetry view',
            status: 'LAYOUT',
            color: '#d9a441',
            action: () => {
                this.wm.setMode(this.wm.mode === 'split' ? 'single' : 'split');
            }
        });

        this.items.push({
            type: 'COMMAND',
            id: 'cmd_open_brand_guide',
            code: 'BRAND',
            title: 'MEKSAT Brand Identity Guidelines & Asset Kit',
            subtitle: 'Precision monoline vector mark, color tokens, typography, field gear',
            status: 'GUIDELINE',
            color: '#38bdf8',
            action: () => {
                window.location.href = 'meksat_brand_identity.html';
            }
        });

        this.items.push({
            type: 'COMMAND',
            id: 'cmd_open_surveyor',
            code: 'TOOL',
            title: 'Launch 1:1 Dam-Cut Surveyor Workbench',
            subtitle: 'Elevation profile, optical/SAR split slider, PCHIP cross-section',
            status: 'ENGINE',
            color: '#38bdf8',
            action: () => {
                window.location.href = 'dam_cut_surveyor.html';
            }
        });
    }

    _buildDom() {
        const modal = document.createElement('div');
        modal.id = 'commandPaletteModal';
        modal.className = 'portal-modal-overlay items-start pt-24 px-4';
        modal.innerHTML = `
            <div class="w-full max-w-2xl bg-[#171719] border border-[#2c2b30] rounded-lg overflow-hidden flex flex-col text-slate-200">
                <!-- Search Input Bar -->
                <div class="p-3 bg-[#131217] border-b border-[#222224] flex items-center space-x-3">
                    <svg class="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <input id="cpSearchInput" type="text" placeholder="Type a branch code (B01-B13), dam name, basin, or command..." 
                        class="bg-transparent text-sm w-full focus:outline-none text-white placeholder-slate-500 font-sans" autocomplete="off" />
                    <span class="text-[11px] font-mono-tabular text-slate-400 bg-[#212023] px-2 py-0.5 rounded border border-[#333338]">ESC</span>
                </div>

                <!-- Results List -->
                <div id="cpResultsList" class="max-h-96 overflow-y-auto p-2 space-y-1 divide-y divide-[#1b1a1f]">
                    <!-- Dynamically populated -->
                </div>

                <!-- Bottom Shortcut Hints -->
                <div class="p-2.5 bg-[#100f13] border-t border-[#222224] text-xs text-slate-400 flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <span><kbd class="px-1.5 py-0.5 rounded bg-[#212023] text-slate-300 font-mono-tabular">↑↓</kbd> Navigate</span>
                        <span><kbd class="px-1.5 py-0.5 rounded bg-[#212023] text-slate-300 font-mono-tabular">↵</kbd> Open in Primary</span>
                        <span><kbd class="px-1.5 py-0.5 rounded bg-[#212023] text-slate-300 font-mono-tabular">Alt + ↵</kbd> Open in Split View</span>
                    </div>
                    <span class="text-[11px] text-slate-400 font-mono-tabular">13 Branches • SOTA Geodesy</span>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        this.modalEl = modal;
        this.inputEl = modal.querySelector('#cpSearchInput');
        this.listEl = modal.querySelector('#cpResultsList');

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        // Input filtering
        this.inputEl.addEventListener('input', () => {
            this.filter(this.inputEl.value);
        });

        // Keydown handlers
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.filteredItems.length);
                this._renderList();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % Math.max(1, this.filteredItems.length);
                this._renderList();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = this.filteredItems[this.selectedIndex];
                if (item) {
                    const slot = e.altKey ? 'secondary' : 'primary';
                    item.action(slot);
                    this.close();
                }
            }
        });
    }

    _bindShortcuts() {
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
            // Quick mode toggles outside inputs
            if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                if (e.key === '1') {
                    this.wm.setMode('single');
                } else if (e.key === '2') {
                    this.wm.setMode('split');
                }
            }
        });
    }

    open() {
        this.isOpen = true;
        this.modalEl.classList.add('open');
        this.inputEl.value = '';
        this.filter('');
        setTimeout(() => this.inputEl.focus(), 50);
    }

    close() {
        this.isOpen = false;
        this.modalEl.classList.remove('open');
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    filter(query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            this.filteredItems = [...this.items];
        } else {
            this.filteredItems = this.items.filter(item => {
                return (
                    item.title.toLowerCase().includes(q) ||
                    item.subtitle.toLowerCase().includes(q) ||
                    item.code.toLowerCase().includes(q) ||
                    item.id.toLowerCase().includes(q)
                );
            });
        }
        this.selectedIndex = 0;
        this._renderList();
    }

    _renderList() {
        if (this.filteredItems.length === 0) {
            this.listEl.innerHTML = `
                <div class="py-8 text-center text-xs text-slate-500 font-mono">
                    No matching telemetry branch, reservoir, or tool found for "${this.inputEl.value}".
                </div>
            `;
            return;
        }

        this.listEl.innerHTML = this.filteredItems.map((item, index) => {
            const isSelected = index === this.selectedIndex;
            return `
                <div class="group p-2.5 rounded cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-[#212023] border-l-2 border-sky-400' : 'hover:bg-[#1a191e] border-l-2 border-transparent'
                }" data-index="${index}">
                    <div class="flex items-center space-x-3 min-w-0">
                        <span class="text-[11px] font-mono-tabular font-bold px-1.5 py-0.5 rounded border border-[#2c2b30]" style="color: ${item.color}; background: rgba(255,255,255,0.03);">
                            ${item.code}
                        </span>
                        <div class="min-w-0 truncate">
                            <div class="text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-200'} truncate">
                                ${item.title}
                            </div>
                            <div class="text-[11px] text-slate-400 truncate">
                                ${item.subtitle}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 flex-shrink-0 ml-3">
                        <span class="text-[11px] font-mono-tabular px-1.5 py-0.5 rounded bg-[#100f13] text-slate-300 border border-[#222224]">
                            ${item.status}
                        </span>
                        <button class="split-btn hidden group-hover:inline-block px-2 py-0.5 rounded bg-[#2c2b30] hover:bg-sky-950 hover:text-sky-300 text-[11px] text-slate-300 font-mono-tabular" title="Open in Split View">
                            Split ⇲
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click handlers
        const rowEls = this.listEl.querySelectorAll('[data-index]');
        rowEls.forEach(row => {
            const idx = parseInt(row.dataset.index, 10);
            const item = this.filteredItems[idx];
            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('split-btn')) {
                    item.action('secondary');
                } else {
                    item.action('primary');
                }
                this.close();
            });
        });

        // Ensure selected row is scrolled into view
        const activeRow = rowEls[this.selectedIndex];
        if (activeRow) {
            activeRow.scrollIntoView({ block: 'nearest' });
        }
    }
}
