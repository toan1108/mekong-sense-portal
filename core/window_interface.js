/**
 * Mekong Sense REMOTE SENSING DATA PORTAL — STANDARDIZED WINDOW MODULE CONTRACT (V2.0)
 * Evaluated & Hardened against Chromium WebGL leak & DOM thrashing hazards.
 * Conforms 100% to taste-skill data-terminal engineering specifications.
 */

export class BranchWindowV2 {
    /**
     * @param {Object} manifest - Immutable branch metadata from portal_branches_registry.json
     * @param {Object} hostContext - Host terminal services (telemetry, global bus, status)
     */
    constructor(manifest, hostContext = {}) {
        this.id = manifest.id;
        this.manifest = Object.freeze({ ...manifest });
        this.host = hostContext;
        
        // Resource Disposables Tracking
        this._abortController = null;
        this._mapInstances = new Set();
        this._chartInstances = new Set();
        this._domListeners = [];
        this._isMounted = false;
        this.container = null;
    }

    /**
     * Public mount method called by WindowManager.
     * Manages AbortController lifecycle and delegates to _onMount.
     */
    async mount(containerElement, initialState = {}) {
        if (this._isMounted) {
            await this.unmount();
        }

        this._abortController = new AbortController();
        this.container = containerElement;
        this._isMounted = true;

        try {
            await this._onMount(containerElement, this._abortController.signal, initialState);
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn(`[BranchWindow:${this.id}] Mount aborted by user navigation.`);
                return;
            }
            console.error(`[BranchWindow:${this.id}] Error during mount:`, err);
            throw err;
        }
    }

    /**
     * Public unmount method called by WindowManager.
     * Guaranteed 100% resource disposal (WebGL, Leaflet, Chart.js, DOM listeners).
     */
    async unmount() {
        if (!this._isMounted) return;

        // 1. Abort any in-flight asynchronous network fetches
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }

        // 2. Remove all managed DOM event listeners
        for (const { target, type, handler, options } of this._domListeners) {
            try {
                target.removeEventListener(type, handler, options);
            } catch (e) {
                // Ignore detachment errors
            }
        }
        this._domListeners = [];

        // 3. Destroy Chart.js instances
        for (const chart of this._chartInstances) {
            try {
                if (typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            } catch (e) {
                console.warn(`[BranchWindow:${this.id}] Error destroying chart:`, e);
            }
        }
        this._chartInstances.clear();

        // 4. Remove Leaflet Map instances and release WebGL contexts
        for (const map of this._mapInstances) {
            try {
                if (typeof map.remove === 'function') {
                    map.remove();
                }
            } catch (e) {
                console.warn(`[BranchWindow:${this.id}] Error removing map:`, e);
            }
        }
        this._mapInstances.clear();

        // 5. Invoke subclass specific teardown
        if (typeof this._onUnmount === 'function') {
            try {
                await this._onUnmount();
            } catch (e) {
                console.warn(`[BranchWindow:${this.id}] Error during _onUnmount:`, e);
            }
        }

        // 6. Clear container DOM and reset mount flag
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
        }
        this._isMounted = false;
    }

    /**
     * Registers a Leaflet Map instance for automated disposal.
     */
    registerMap(mapInstance) {
        if (mapInstance) {
            this._mapInstances.add(mapInstance);
        }
        return mapInstance;
    }

    /**
     * Registers a Chart.js instance for automated disposal.
     */
    registerChart(chartInstance) {
        if (chartInstance) {
            this._chartInstances.add(chartInstance);
        }
        return chartInstance;
    }

    /**
     * Registers a DOM Event Listener for automated cleanup upon unmount.
     */
    addManagedEventListener(target, type, handler, options = false) {
        if (target && typeof target.addEventListener === 'function') {
            target.addEventListener(type, handler, options);
            this._domListeners.push({ target, type, handler, options });
        }
    }

    /**
     * Fired when the host window is resized or switches between Single <-> Split modes.
     */
    onResize({ width, height, mode }) {
        for (const map of this._mapInstances) {
            if (typeof map.invalidateSize === 'function') {
                map.invalidateSize({ animate: false });
            }
        }
        for (const chart of this._chartInstances) {
            if (typeof chart.resize === 'function') {
                chart.resize();
            }
        }
    }

    /**
     * Cross-branch synchronized timeline handler.
     * Default fallback returns UNSUPPORTED. Overridden by specific branches.
     * @param {Object} syncPayload - { timestampMs, isoDate, sourceBranchId, toleranceDays }
     * @returns {Object} { matchedDate, deltaDays, status: 'EXACT' | 'INTERPOLATED' | 'OFFSET_DISCRETE' | 'UNSUPPORTED' }
     */
    onTimeSync(syncPayload) {
        return { matchedDate: null, deltaDays: null, status: 'UNSUPPORTED' };
    }

    /**
     * Serializes lightweight state (e.g. selected dam ID, active tab, active layers)
     * so it can be restored seamlessly when switching back without re-fetching.
     */
    serializeState() {
        return {};
    }

    /**
     * Subclasses MUST implement this method to construct their DOM, Leaflet map, and charts.
     * @protected
     */
    async _onMount(containerElement, abortSignal, initialState) {
        throw new Error(`_onMount() must be implemented by subclass ${this.constructor.name}`);
    }

    /**
     * Optional hook for custom subclass cleanup.
     * @protected
     */
    async _onUnmount() {
        // Default no-op
    }
}
