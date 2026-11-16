/**
 * Mekong Sense REMOTE SENSING DATA PORTAL — WINDOW MANAGER CORE (V2.0)
 * Manages Single / Split View workbenches, enforces 2-DOM hard ceiling,
 * throttles synchronized timeline scrubbing, and drives Top Flight Bar tabs.
 */

export class WindowManager {
    constructor(options = {}) {
        this.registry = null;
        this.moduleConstructors = new Map(); // branchId -> WindowClass
        
        // Window Topology
        this.mode = 'single'; // 'single' | 'split'
        this.openTabs = [];   // List of branchIds currently open as tabs
        this.primaryId = null;
        this.secondaryId = null;

        // Mounted window instances (Max 2 in DOM)
        this.mountedWindows = new Map(); // branchId -> BranchWindowV2 instance
        this.stateCache = new Map();     // branchId -> serializedState

        // DOM Anchors
        this.dom = {
            tabsContainer: options.tabsContainer || null,
            primaryContainer: options.primaryContainer || null,
            secondaryContainer: options.secondaryContainer || null,
            dividerElement: options.dividerElement || null,
            telemetryContainer: options.telemetryContainer || null,
            modeToggleBtn: options.modeToggleBtn || null
        };

        // TimeSyncBus (Throttled with requestAnimationFrame)
        this._rafSyncId = null;
        this._pendingSyncPayload = null;

        // Window Resize Observer
        this._resizeObserver = null;
    }

    /**
     * Initializes the Window Manager with registry and containers.
     */
    async init(registryData, moduleClassMap = {}) {
        this.registry = registryData;
        for (const [id, cls] of Object.entries(moduleClassMap)) {
            this.moduleConstructors.set(id, cls);
        }

        // Setup ResizeObserver on the workspace canvas
        if (this.dom.primaryContainer && window.ResizeObserver) {
            this._resizeObserver = new ResizeObserver((entries) => {
                window.requestAnimationFrame(() => {
                    this.broadcastResize();
                });
            });
            this._resizeObserver.observe(this.dom.primaryContainer.parentElement);
        }

        // Setup Split / Single Mode Toggle Button Listener
        if (this.dom.modeToggleBtn) {
            this.dom.modeToggleBtn.addEventListener('click', () => {
                this.setMode(this.mode === 'split' ? 'single' : 'split');
            });
        }

        // Open default active branch
        const defaultBranch = this.registry.defaultActiveBranch || this.registry.branches[0].id;
        await this.openBranch(defaultBranch, 'primary');
    }

    /**
     * Register a window class dynamically.
     */
    registerModule(branchId, WindowClass) {
        this.moduleConstructors.set(branchId, WindowClass);
    }

    /**
     * Opens a branch in the primary or secondary slot.
     */
    async openBranch(branchId, slot = 'primary') {
        const branchDef = this.registry.branches.find(b => b.id === branchId);
        if (!branchDef) {
            console.error(`[WindowManager] Branch ${branchId} not found in registry.`);
            return;
        }

        // Add to tabs if not already present
        if (!this.openTabs.includes(branchId)) {
            this.openTabs.push(branchId);
        }

        if (slot === 'primary') {
            if (this.primaryId === branchId && this.mountedWindows.has(branchId)) {
                return; // Already active in primary
            }
            // If branch was in secondary, swap or clear secondary
            if (this.secondaryId === branchId) {
                this.secondaryId = null;
            }
            await this._mountSlot('primary', branchId);
            this.primaryId = branchId;
        } else {
            // Secondary slot (for Split View)
            if (this.secondaryId === branchId && this.mountedWindows.has(branchId)) {
                return;
            }
            if (this.primaryId === branchId) {
                console.warn("[WindowManager] Cannot open same branch in both slots.");
                return;
            }
            await this._mountSlot('secondary', branchId);
            this.secondaryId = branchId;
        }

        this.renderTabs();
        this.updateModeUI();
    }

    /**
     * Closes a tab. If the tab was mounted, switches to another open tab.
     */
    async closeTab(branchId) {
        if (this.openTabs.length <= 1) {
            console.warn("[WindowManager] Cannot close the last open tab.");
            return;
        }

        const idx = this.openTabs.indexOf(branchId);
        if (idx !== -1) {
            this.openTabs.splice(idx, 1);
        }

        // If this branch is mounted, unmount it
        if (this.mountedWindows.has(branchId)) {
            const inst = this.mountedWindows.get(branchId);
            await inst.unmount();
            this.mountedWindows.delete(branchId);
            this.stateCache.delete(branchId);
        }

        // If it was primary, pick the nearest tab
        if (this.primaryId === branchId) {
            const nextId = this.openTabs[Math.max(0, idx - 1)] || this.openTabs[0];
            await this.openBranch(nextId, 'primary');
        } else if (this.secondaryId === branchId) {
            this.secondaryId = null;
            if (this.mode === 'split') {
                this.setMode('single');
            }
        }

        this.renderTabs();
    }

    /**
     * Toggles between 'single' and 'split' display modes.
     */
    async setMode(newMode) {
        if (this.mode === newMode) return;
        this.mode = newMode;

        const shell = this.dom.primaryContainer ? this.dom.primaryContainer.parentElement : null;
        if (!shell) return;

        if (this.mode === 'split') {
            // Enable split layout
            shell.classList.add('split-view-active');

            // If no secondary is open, pick the next available tab or Branch 02
            if (!this.secondaryId) {
                const candidate = this.openTabs.find(id => id !== this.primaryId) || 
                                 (this.primaryId === 'branch_01_dams' ? 'branch_02_precipitation' : 'branch_01_dams');
                await this.openBranch(candidate, 'secondary');
            }
        } else {
            // Revert to single layout
            shell.classList.remove('split-view-active');

            // Unmount secondary window to enforce max 1 DOM in single mode
            if (this.secondaryId && this.mountedWindows.has(this.secondaryId)) {
                const secWin = this.mountedWindows.get(this.secondaryId);
                this.stateCache.set(this.secondaryId, secWin.serializeState());
                await secWin.unmount();
                this.mountedWindows.delete(this.secondaryId);
            }
        }

        this.updateModeUI();
        window.requestAnimationFrame(() => {
            this.broadcastResize();
        });
        setTimeout(() => {
            this.broadcastResize();
        }, 100);
        setTimeout(() => {
            this.broadcastResize();
        }, 300);
    }

    /**
     * Broadcasts resize event to all currently mounted windows.
     */
    broadcastResize() {
        for (const [id, win] of this.mountedWindows.entries()) {
            if (win && typeof win.onResize === 'function') {
                const targetDom = id === this.primaryId ? this.dom.primaryContainer : this.dom.secondaryContainer;
                const rect = targetDom ? targetDom.getBoundingClientRect() : { width: 0, height: 0 };
                win.onResize({
                    width: rect.width,
                    height: rect.height,
                    mode: this.mode
                });
            }
        }
    }

    /**
     * Synchronized timeline scrubber event bus with 16ms RAF throttling.
     */
    dispatchTimeSync(syncPayload) {
        this._pendingSyncPayload = syncPayload;
        if (this._rafSyncId !== null) return;

        this._rafSyncId = window.requestAnimationFrame(() => {
            const payload = this._pendingSyncPayload;
            this._pendingSyncPayload = null;
            this._rafSyncId = null;

            if (!payload) return;

            // Notify mounted windows that did NOT originate the event
            for (const [id, win] of this.mountedWindows.entries()) {
                if (id !== payload.sourceBranchId && win && typeof win.onTimeSync === 'function') {
                    win.onTimeSync(payload);
                }
            }
        });
    }

    /**
     * Updates telemetry indicators on the Top Flight Bar for the active window.
     */
    updateTelemetry(telemetryItems = []) {
        if (!this.dom.telemetryContainer) return;
        this.dom.telemetryContainer.innerHTML = '';

        for (const item of telemetryItems) {
            const el = document.createElement('div');
            el.className = 'telemetry-item flex items-center space-x-1 font-mono text-[11px] text-slate-400';
            el.innerHTML = `
                <span>${item.label}:</span>
                <strong class="font-bold ml-1" style="color: ${item.color || '#ffffff'};">${item.value}</strong>
            `;
            this.dom.telemetryContainer.appendChild(el);
        }
    }

    /**
     * Renders Top Flight Bar tabs conforming to "The Move" (1px accent bottom border).
     */
    renderTabs() {
        if (!this.dom.tabsContainer) return;
        this.dom.tabsContainer.innerHTML = '';

        for (const branchId of this.openTabs) {
            const branch = this.registry.branches.find(b => b.id === branchId);
            if (!branch) continue;

            const isPrimary = this.primaryId === branchId;
            const isSecondary = this.mode === 'split' && this.secondaryId === branchId;
            const isActive = isPrimary || isSecondary;

            const btn = document.createElement('div');
            btn.className = `terminal-window-tab ${isActive ? 'active' : ''} ${isSecondary ? 'secondary-tab' : ''}`;
            btn.onclick = () => this.openBranch(branchId, 'primary');

            // Format tab title and badge
            btn.innerHTML = `
                <span class="tab-code text-[11px] font-mono-tabular px-1.5 py-0.5 rounded mr-1.5" style="background: rgba(255,255,255,0.06); color: ${branch.color};">${branch.code}</span>
                <span class="tab-label text-xs font-semibold">${branch.shortTitle}</span>
                <span class="tab-badge text-[11px] font-mono-tabular text-slate-300 ml-1.5 hidden md:inline">(${branch.badge})</span>
                ${this.openTabs.length > 1 ? `<span class="tab-close ml-2 text-slate-400 hover:text-white font-mono-tabular text-xs" title="Close window">x</span>` : ''}
            `;

            // Close button click handler
            const closeBtn = btn.querySelector('.tab-close');
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.closeTab(branchId);
                };
            }

            this.dom.tabsContainer.appendChild(btn);
        }
    }

    /**
     * Updates Split View toggle button UI.
     */
    updateModeUI() {
        if (!this.dom.modeToggleBtn) return;
        const isSplit = this.mode === 'split';
        this.dom.modeToggleBtn.classList.toggle('active', isSplit);
        this.dom.modeToggleBtn.title = isSplit ? "Switch to Single Window [1]" : "Switch to Split View [2]";
        this.dom.modeToggleBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${isSplit ? 
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>' : 
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v16m6-16v16M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>'}
            </svg>
            <span>${isSplit ? 'Single [1]' : 'Split [2]'}</span>
        `;
    }

    /**
     * Internal slot mounting mechanism. Enforces 2-DOM hard ceiling.
     * @private
     */
    async _mountSlot(slotName, branchId) {
        const targetContainer = slotName === 'primary' ? this.dom.primaryContainer : this.dom.secondaryContainer;
        if (!targetContainer) return;

        // 1. If slot already has a window mounted, unmount and cache state
        const currentBranchInSlot = slotName === 'primary' ? this.primaryId : this.secondaryId;
        if (currentBranchInSlot && this.mountedWindows.has(currentBranchInSlot)) {
            const oldWin = this.mountedWindows.get(currentBranchInSlot);
            this.stateCache.set(currentBranchInSlot, oldWin.serializeState());
            await oldWin.unmount();
            this.mountedWindows.delete(currentBranchInSlot);
        }

        // 2. Resolve module constructor (or fallback to spec viewer)
        let WindowClass = this.moduleConstructors.get(branchId);
        if (!WindowClass) {
            // Lazy load fallback or spec viewer
            const branchDef = this.registry.branches.find(b => b.id === branchId);
            if (branchDef && branchDef.modulePath) {
                try {
                    const mod = await import(`../${branchDef.modulePath}`);
                    WindowClass = mod.default || mod[Object.keys(mod)[0]];
                    this.moduleConstructors.set(branchId, WindowClass);
                } catch (e) {
                    console.warn(`[WindowManager] Could not dynamically import ${branchDef.modulePath}, using SpecViewer fallback.`, e);
                    const mod = await import('../windows/window_spec_viewer.js');
                    WindowClass = mod.default || mod.WindowSpecViewer;
                    this.moduleConstructors.set(branchId, WindowClass);
                }
            }
        }

        // 3. Create host context
        const hostContext = {
            updateTelemetry: (items) => {
                if (this.primaryId === branchId) {
                    this.updateTelemetry(items);
                }
            },
            emitTimeSync: (payload) => {
                this.dispatchTimeSync({ ...payload, sourceBranchId: branchId });
            },
            notifyStatus: (msg) => {
                console.log(`[PortalHost:${branchId}] ${msg}`);
            }
        };

        // 4. Instantiate and mount
        const branchDef = this.registry.branches.find(b => b.id === branchId);
        const winInstance = new WindowClass(branchDef, hostContext);
        this.mountedWindows.set(branchId, winInstance);

        const cachedState = this.stateCache.get(branchId) || {};
        await winInstance.mount(targetContainer, cachedState);

        // Update telemetry for primary slot
        if (slotName === 'primary') {
            if (typeof winInstance.getTelemetrySummary === 'function') {
                this.updateTelemetry(winInstance.getTelemetrySummary());
            }
        }

        // Trigger multi-stage broadcastResize to guarantee zero black-tile viewports
        window.requestAnimationFrame(() => {
            this.broadcastResize();
        });
        setTimeout(() => {
            this.broadcastResize();
        }, 120);
        setTimeout(() => {
            this.broadcastResize();
        }, 350);
    }
}
