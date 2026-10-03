/**
 * Intelligent Multi-Tier Cloud & Edge Workload Simulator UI Controller
 */

document.addEventListener("DOMContentLoaded", () => {

    // Global App State
    let currentTiers = JSON.parse(JSON.stringify(DEFAULT_TIERS_CONFIG));
    let simulationResult = null;
    let chartInstances = {};

    // DOM Elements
    const runBtn = document.getElementById("run-btn");
    const presetSelector = document.getElementById("preset-selector");
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const weightInputs = document.querySelectorAll(".weight-input");
    const tierTableBody = document.getElementById("tier-config-table-body");
    const addTierBtn = document.getElementById("add-tier-btn");
    const resetTierConfigBtn = document.getElementById("reset-tier-config-btn");
    const resetRunConfigBtn = document.getElementById("reset-run-config-btn");
    const algorithmViewSelect = document.getElementById("algorithm-view-select");
    const infraGrid = document.getElementById("infrastructure-cards-container");
    const resultsTableBody = document.getElementById("results-metrics-body");
    const workloadTraceBody = document.getElementById("workload-trace-body");
    const workloadSearchInput = document.getElementById("workload-search");
    const exportCsvBtn = document.getElementById("export-csv-btn");
    const modalOverlay = document.getElementById("workload-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");

    // Pre-defined presets
    const PRESETS = {
        "default": {
            tiers: DEFAULT_TIERS_CONFIG,
            weights: { latency_weight: 0.45, cost_weight: 0.15, utilization_weight: 0.15, compliance_weight: 0.15, sla_weight: 0.10 },
            workload_size: 500
        },
        "ai-cluster": {
            tiers: [
                { name: "On-Prem GPU Supercluster", gpu: 128, cpu: 512, memory: 2048, latency_ms: 5, cost: 2.5, bandwidth_mb_ms: 300, compliance: ["GDPR", "PCI", "HIPAA", "SOX", "NONE"], sensitivity_max: 5, type: "private-cloud", description: "H100 NVLink Cluster for LLM Training", enabled: true },
                { name: "Public AI Cloud", gpu: 256, cpu: 1024, memory: 4096, latency_ms: 40, cost: 1.8, bandwidth_mb_ms: 500, compliance: ["GDPR", "SOX", "NONE"], sensitivity_max: 3, type: "public-cloud", description: "On-Demand TPU/GPU Cloud instances", enabled: true },
                { name: "Micro AI Edge", gpu: 16, cpu: 64, memory: 256, latency_ms: 2, cost: 0.6, bandwidth_mb_ms: 100, compliance: ["NONE", "GDPR"], sensitivity_max: 4, type: "edge-node", description: "Edge NPU for Low-Latency Vision & Audio Inference", enabled: true }
            ],
            weights: { latency_weight: 0.20, cost_weight: 0.35, utilization_weight: 0.25, compliance_weight: 0.10, sla_weight: 0.10 },
            workload_size: 1000
        },
        "edge-mesh": {
            tiers: [
                { name: "Central Core Cloud", gpu: 32, cpu: 256, memory: 1024, latency_ms: 80, cost: 0.4, bandwidth_mb_ms: 200, compliance: ["GDPR", "PCI", "NONE"], sensitivity_max: 3, type: "public-cloud", description: "Central Region Datacenter", enabled: true },
                { name: "Regional Edge Hub", gpu: 16, cpu: 64, memory: 256, latency_ms: 15, cost: 0.3, bandwidth_mb_ms: 120, compliance: ["GDPR", "HIPAA", "NONE"], sensitivity_max: 4, type: "private-cloud", description: "Regional Distribution Server", enabled: true },
                { name: "5G Base Cell Tower", gpu: 4, cpu: 16, memory: 64, latency_ms: 1, cost: 0.15, bandwidth_mb_ms: 50, compliance: ["NONE", "GDPR"], sensitivity_max: 5, type: "edge-node", description: "Ultra-Reliable Low-Latency 5G Tower Node", enabled: true }
            ],
            weights: { latency_weight: 0.50, cost_weight: 0.10, utilization_weight: 0.10, compliance_weight: 0.10, sla_weight: 0.20 },
            workload_size: 800
        },
        "multi-region": {
            tiers: [
                { name: "US-East Datacenter", gpu: 64, cpu: 256, memory: 1024, latency_ms: 20, cost: 0.7, bandwidth_mb_ms: 150, compliance: ["GDPR", "PCI", "SOX", "NONE"], sensitivity_max: 5, type: "private-cloud", description: "US Enterprise Core Datacenter", enabled: true },
                { name: "EU-West Public Region", gpu: 64, cpu: 256, memory: 1024, latency_ms: 50, cost: 0.55, bandwidth_mb_ms: 180, compliance: ["GDPR", "SOX", "NONE"], sensitivity_max: 3, type: "public-cloud", description: "EU Sovereign Cloud Zone", enabled: true },
                { name: "APAC Edge Gateway", gpu: 8, cpu: 32, memory: 128, latency_ms: 8, cost: 0.35, bandwidth_mb_ms: 80, compliance: ["NONE", "GDPR"], sensitivity_max: 4, type: "edge-node", description: "Asia-Pacific Regional Edge Node", enabled: true }
            ],
            weights: { latency_weight: 0.30, cost_weight: 0.20, utilization_weight: 0.15, compliance_weight: 0.20, sla_weight: 0.15 },
            workload_size: 1500
        }
    };

    // Tab Navigation Logic
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            const tabId = btn.getAttribute("data-tab");
            document.getElementById(tabId).classList.add("active");
        });
    });

    // Weight Normalization Live Calculation & Renderer
    function updateWeightNormalization() {
        const raw = {
            latency_weight: parseFloat(document.getElementById("input-w-latency").value) || 0,
            cost_weight: parseFloat(document.getElementById("input-w-cost").value) || 0,
            utilization_weight: parseFloat(document.getElementById("input-w-util").value) || 0,
            compliance_weight: parseFloat(document.getElementById("input-w-comp").value) || 0,
            sla_weight: parseFloat(document.getElementById("input-w-sla").value) || 0,
        };

        const normalized = normalizeWeights(raw);

        // Update badge text
        document.getElementById("norm-latency").innerText = `Norm: ${normalized.latency_weight.toFixed(3)}`;
        document.getElementById("norm-cost").innerText = `Norm: ${normalized.cost_weight.toFixed(3)}`;
        document.getElementById("norm-util").innerText = `Norm: ${normalized.utilization_weight.toFixed(3)}`;
        document.getElementById("norm-comp").innerText = `Norm: ${normalized.compliance_weight.toFixed(3)}`;
        document.getElementById("norm-sla").innerText = `Norm: ${normalized.sla_weight.toFixed(3)}`;

        // Render weight bar
        const barContainer = document.getElementById("weight-bar-render");
        const labelsContainer = document.getElementById("weight-labels-render");

        const config = [
            { key: "latency_weight", label: "Latency", color: "#3b82f6", val: normalized.latency_weight },
            { key: "cost_weight", label: "Cost", color: "#6366f1", val: normalized.cost_weight },
            { key: "utilization_weight", label: "Utilization", color: "#06b6d4", val: normalized.utilization_weight },
            { key: "compliance_weight", label: "Compliance", color: "#10b981", val: normalized.compliance_weight },
            { key: "sla_weight", label: "SLA", color: "#f59e0b", val: normalized.sla_weight }
        ];

        barContainer.innerHTML = config.map(c => `
            <div class="weight-segment" style="width: ${c.val * 100}%; background-color: ${c.color};" title="${c.label}: ${(c.val * 100).toFixed(1)}%"></div>
        `).join("");

        labelsContainer.innerHTML = config.map(c => `
            <div class="weight-label-item">
                <div class="dot" style="background-color: ${c.color};"></div>
                <span>${c.label}: ${(c.val * 100).toFixed(1)}%</span>
            </div>
        `).join("");
    }

    weightInputs.forEach(input => {
        input.addEventListener("input", updateWeightNormalization);
    });

    // Tier Configuration Table Renderer
    function renderTierTable() {
        tierTableBody.innerHTML = currentTiers.map((t, idx) => `
            <tr>
                <td>
                    <input type="checkbox" class="tier-toggle" data-idx="${idx}" ${t.enabled !== false ? 'checked' : ''}>
                </td>
                <td>
                    <input type="text" class="form-control tier-edit-field" data-idx="${idx}" data-field="name" value="${t.name}">
                </td>
                <td>
                    <input type="number" class="form-control tier-edit-field" data-idx="${idx}" data-field="gpu" value="${t.gpu}" style="width: 70px;">
                </td>
                <td>
                    <input type="number" class="form-control tier-edit-field" data-idx="${idx}" data-field="cpu" value="${t.cpu}" style="width: 80px;">
                </td>
                <td>
                    <input type="number" class="form-control tier-edit-field" data-idx="${idx}" data-field="memory" value="${t.memory}" style="width: 90px;">
                </td>
                <td>
                    <input type="number" class="form-control tier-edit-field" data-idx="${idx}" data-field="latency_ms" value="${t.latency_ms}" style="width: 80px;">
                </td>
                <td>
                    <input type="number" class="form-control tier-edit-field" data-idx="${idx}" data-field="cost" value="${t.cost}" step="0.05" style="width: 80px;">
                </td>
                <td>
                    <input type="number" class="form-control tier-edit-field" data-idx="${idx}" data-field="bandwidth_mb_ms" value="${t.bandwidth_mb_ms}" style="width: 80px;">
                </td>
                <td>
                    <input type="text" class="form-control tier-edit-field" data-idx="${idx}" data-field="compliance" value="${Array.isArray(t.compliance) ? t.compliance.join(', ') : t.compliance}">
                </td>
                <td>
                    <input type="number" class="form-control tier-edit-field" data-idx="${idx}" data-field="sensitivity_max" value="${t.sensitivity_max}" min="1" max="5" style="width: 65px;">
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm delete-tier-btn" data-idx="${idx}" title="Delete Tier">&times;</button>
                </td>
            </tr>
        `).join("");

        // Attach listeners for tier table editing
        document.querySelectorAll(".tier-toggle").forEach(cb => {
            cb.addEventListener("change", (e) => {
                const idx = parseInt(e.target.getAttribute("data-idx"));
                currentTiers[idx].enabled = e.target.checked;
            });
        });

        document.querySelectorAll(".tier-edit-field").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const idx = parseInt(e.target.getAttribute("data-idx"));
                const field = e.target.getAttribute("data-field");
                let val = e.target.value;
                if (field === "compliance") {
                    currentTiers[idx][field] = val.split(',').map(s => s.trim());
                } else if (field === "name") {
                    currentTiers[idx][field] = val;
                } else {
                    currentTiers[idx][field] = parseFloat(val) || 0;
                }
            });
        });

        document.querySelectorAll(".delete-tier-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.target.getAttribute("data-idx"));
                if (currentTiers.length <= 1) {
                    alert("Simulation requires at least 1 infrastructure tier.");
                    return;
                }
                currentTiers.splice(idx, 1);
                renderTierTable();
            });
        });
    }

    addTierBtn.addEventListener("click", () => {
        const newTier = {
            name: `Custom Tier ${currentTiers.length + 1}`,
            gpu: 16,
            cpu: 64,
            memory: 256,
            latency_ms: 15,
            cost: 0.4,
            bandwidth_mb_ms: 100,
            compliance: ["GDPR", "NONE"],
            sensitivity_max: 4,
            type: "private-cloud",
            description: "Custom Added Infrastructure Tier",
            enabled: true
        };
        currentTiers.push(newTier);
        renderTierTable();
    });

    resetTierConfigBtn.addEventListener("click", () => {
        currentTiers = JSON.parse(JSON.stringify(DEFAULT_TIERS_CONFIG));
        renderTierTable();
    });

    resetRunConfigBtn.addEventListener("click", () => {
        document.getElementById("input-workload-size").value = 500;
        document.getElementById("input-arrival-pattern").value = "dynamic";
        document.getElementById("input-seed").value = 1001;
        document.getElementById("input-ga-pop").value = 14;
        document.getElementById("input-ga-gen").value = 12;
        document.getElementById("input-nsga-pop").value = 14;
        document.getElementById("input-nsga-gen").value = 10;

        document.getElementById("input-w-latency").value = 0.45;
        document.getElementById("input-w-cost").value = 0.15;
        document.getElementById("input-w-util").value = 0.15;
        document.getElementById("input-w-comp").value = 0.15;
        document.getElementById("input-w-sla").value = 0.10;
        updateWeightNormalization();
    });

    // Preset selector event
    presetSelector.addEventListener("change", (e) => {
        const key = e.target.value;
        const preset = PRESETS[key] || PRESETS["default"];
        currentTiers = JSON.parse(JSON.stringify(preset.tiers));
        renderTierTable();

        document.getElementById("input-w-latency").value = preset.weights.latency_weight;
        document.getElementById("input-w-cost").value = preset.weights.cost_weight;
        document.getElementById("input-w-util").value = preset.weights.utilization_weight;
        document.getElementById("input-w-comp").value = preset.weights.compliance_weight;
        document.getElementById("input-w-sla").value = preset.weights.sla_weight;
        document.getElementById("input-workload-size").value = preset.workload_size;
        updateWeightNormalization();
    });

    // Main Run Simulation Trigger
    runBtn.addEventListener("click", executeSimulation);

    function executeSimulation() {
        runBtn.innerHTML = `
            <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle>
            </svg>
            Simulating...
        `;
        runBtn.disabled = true;

        setTimeout(() => {
            try {
                const runConfig = {
                    workload_size: document.getElementById("input-workload-size").value,
                    arrival_pattern: document.getElementById("input-arrival-pattern").value,
                    seed: document.getElementById("input-seed").value,
                    ga_population: document.getElementById("input-ga-pop").value,
                    ga_generations: document.getElementById("input-ga-gen").value,
                    nsga_population: document.getElementById("input-nsga-pop").value,
                    nsga_generations: document.getElementById("input-nsga-gen").value,

                    latency_weight: document.getElementById("input-w-latency").value,
                    cost_weight: document.getElementById("input-w-cost").value,
                    utilization_weight: document.getElementById("input-w-util").value,
                    compliance_weight: document.getElementById("input-w-comp").value,
                    sla_weight: document.getElementById("input-w-sla").value,
                };

                simulationResult = runMetaSimulation(currentTiers, runConfig);

                // Update UI views
                renderGraphicalPlacement();
                renderResultsMetrics();
                renderWorkloadTraces();

                // Switch to Placement tab
                document.querySelector('.tab-btn[data-tab="tab-placement"]').click();

            } catch (err) {
                alert("Simulation Error: " + err.message);
                console.error(err);
            } finally {
                runBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Run Simulation
                `;
                runBtn.disabled = false;
            }
        }, 100);
    }

    // Graphical Infrastructure Placement Renderer
    function renderGraphicalPlacement() {
        if (!simulationResult) return;

        const selectedView = algorithmViewSelect.value;
        const activeAlgo = selectedView === "winner" ? simulationResult.selectedAlgorithm : selectedView;
        const placementData = simulationResult.assignmentFrames[activeAlgo];

        // Update Winner Banner
        document.getElementById("winner-algorithm-name").innerText = `${simulationResult.selectedAlgorithm} (Selected Winner - Score: ${simulationResult.winnerMetrics["Combined Score"]})`;
        document.getElementById("winner-stats-summary").innerText = `Latency: ${simulationResult.winnerMetrics["Average Latency"]} ms | Cost: $${simulationResult.winnerMetrics["Infrastructure Cost"]} | Exec: ${simulationResult.executionTimeMs} ms`;

        // Group workload placements by assigned tier
        const tierGroups = {};
        simulationResult.activeTiers.forEach(t => tierGroups[t.name] = []);
        placementData.forEach(item => {
            if (tierGroups[item.assigned_tier]) {
                tierGroups[item.assigned_tier].push(item);
            }
        });

        // SVG Infrastructure Icons
        const icons = {
            "private-cloud": `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`,
            "public-cloud": `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`,
            "edge-node": `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path><path d="M19.1 4.9c3.9 3.9 3.9 10.2 0 14.1"></path></svg>`
        };

        infraGrid.innerHTML = simulationResult.activeTiers.map(tier => {
            const placedItems = tierGroups[tier.name] || [];
            const tierType = tier.type || (tier.name.toLowerCase().includes("private") ? "private-cloud" : (tier.name.toLowerCase().includes("edge") ? "edge-node" : "public-cloud"));

            // Calculate resource utilization percentages
            const totalCpuReq = placedItems.reduce((a, b) => a + b.cpu_requirement, 0);
            const totalGpuReq = placedItems.reduce((a, b) => a + b.gpu_requirement, 0);
            const totalMemReq = placedItems.reduce((a, b) => a + b.memory_demand_gb, 0);

            const cpuPct = Math.min(100, (totalCpuReq / Math.max(tier.cpu * Math.max(1, placedItems.length / 50), 1)) * 100);
            const gpuPct = Math.min(100, (totalGpuReq / Math.max(tier.gpu * Math.max(1, placedItems.length / 50), 1)) * 100);
            const memPct = Math.min(100, (totalMemReq / Math.max(tier.memory * Math.max(1, placedItems.length / 50), 1)) * 100);

            const badgeClass = tierType === "private-cloud" ? "badge-private" : (tierType === "edge-node" ? "badge-edge" : "badge-public");

            return `
                <div class="infra-card ${tierType}">
                    <div class="infra-header">
                        <div style="display: flex; align-items: center;">
                            <div class="infra-visual-icon">
                                ${icons[tierType] || icons["public-cloud"]}
                            </div>
                            <div>
                                <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${tier.name}</h3>
                                <span class="badge ${badgeClass}">${tierType.replace('-', ' ')}</span>
                            </div>
                        </div>
                        <div style="text-align: right; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">
                            <div>Base Latency: ${tier.latency_ms}ms</div>
                            <div>Cost: $${tier.cost}/hr</div>
                        </div>
                    </div>

                    <!-- Resource Utilization Progress Meters -->
                    <div class="resource-meters">
                        <div class="meter-box">
                            <div class="meter-title">CPU (${totalCpuReq.toFixed(1)} / ${tier.cpu} Cores)</div>
                            <div class="meter-value" style="color: #60a5fa;">${cpuPct.toFixed(0)}%</div>
                            <div class="progress-track">
                                <div class="progress-fill" style="width: ${cpuPct}%; background-color: #3b82f6;"></div>
                            </div>
                        </div>
                        <div class="meter-box">
                            <div class="meter-title">GPU (${totalGpuReq.toFixed(1)} / ${tier.gpu} Units)</div>
                            <div class="meter-value" style="color: #a78bfa;">${gpuPct.toFixed(0)}%</div>
                            <div class="progress-track">
                                <div class="progress-fill" style="width: ${gpuPct}%; background-color: #8b5cf6;"></div>
                            </div>
                        </div>
                        <div class="meter-box">
                            <div class="meter-title">MEM (${totalMemReq.toFixed(1)} / ${tier.memory} GB)</div>
                            <div class="meter-value" style="color: #34d399;">${memPct.toFixed(0)}%</div>
                            <div class="progress-track">
                                <div class="progress-fill" style="width: ${memPct}%; background-color: #10b981;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Placed Workload Items Matrix Grid -->
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 600;">
                        <span>PLACED WORKLOADS (${placedItems.length})</span>
                        <span>Click workload for details</span>
                    </div>

                    <div class="workload-placement-container">
                        <div class="placement-grid">
                            ${placedItems.map(w => {
                                const srcClass = w.source.toLowerCase().includes("google") ? "google" : (w.source.toLowerCase().includes("alibaba") ? "alibaba" : "dataco");
                                return `
                                    <div class="workload-node ${srcClass}" data-wid="${w.workload_id}">
                                        <div class="workload-id">${w.workload_id}</div>
                                        <div class="workload-meta">
                                            <span>P${w.priority_level}</span>
                                            <span style="color: ${w.sla_satisfied ? '#34d399' : '#ef4444'};">${w.latency_ms.toFixed(0)}ms</span>
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        // Attach modal triggers for workload nodes
        document.querySelectorAll(".workload-node").forEach(node => {
            node.addEventListener("click", () => {
                const wid = node.getAttribute("data-wid");
                const item = placementData.find(w => w.workload_id === wid);
                if (item) openWorkloadModal(item);
            });
        });
    }

    algorithmViewSelect.addEventListener("change", renderGraphicalPlacement);

    // Modal Details Handler
    function openWorkloadModal(item) {
        document.getElementById("modal-workload-title").innerText = `Workload: ${item.workload_id}`;
        const content = document.getElementById("modal-workload-content");

        content.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.05); padding: 0.75rem; border-radius: 8px;">
                <div style="color: var(--text-muted); font-size: 0.8rem;">ASSIGNMENT SUMMARY</div>
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">${item.assigned_tier} (${item.method})</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div><strong>Source Trace:</strong> ${item.source}</div>
                <div><strong>Dataset ID:</strong> ${item.dataset_id}</div>
                <div><strong>CPU Requirement:</strong> ${item.cpu_requirement} Cores</div>
                <div><strong>GPU Requirement:</strong> ${item.gpu_requirement} Units</div>
                <div><strong>Memory Demand:</strong> ${item.memory_demand_gb} GB</div>
                <div><strong>Duration:</strong> ${item.execution_duration_s} seconds</div>
                <div><strong>Priority Level:</strong> P${item.priority_level}</div>
                <div><strong>Data Size:</strong> ${item.data_size_mb} MB</div>
                <div><strong>Sensitivity Rating:</strong> Level ${item.sensitivity_level} / 5</div>
                <div><strong>Required Compliance:</strong> ${item.required_compliance}</div>
            </div>

            <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: 0.25rem;">
                <div><strong>Incurred Latency:</strong> ${item.latency_ms} ms (SLA Threshold: ${item.latency_threshold_ms} ms) 
                    <span class="badge ${item.sla_satisfied ? 'badge-edge' : 'badge-private'}">${item.sla_satisfied ? 'SLA OK' : 'SLA BREACH'}</span>
                </div>
                <div style="margin-top: 0.4rem;"><strong>Assigned Cost:</strong> $${item.assignment_cost}</div>
                <div style="margin-top: 0.4rem;"><strong>Compliance Match:</strong> 
                    <span class="badge ${item.compliance_satisfied ? 'badge-edge' : 'badge-private'}">${item.compliance_satisfied ? 'PASSED' : 'VIOLATION'}</span>
                </div>
            </div>
        `;

        modalOverlay.classList.add("active");
    }

    closeModalBtn.addEventListener("click", () => modalOverlay.classList.remove("active"));
    modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.remove("active");
    });

    // Experiment Results Metrics Renderer
    function renderResultsMetrics() {
        if (!simulationResult) return;

        resultsTableBody.innerHTML = simulationResult.scoreMetrics.map(m => {
            const pareto = simulationResult.paretoResults.find(p => p.method === m.method);
            const isWinner = m["Combined Rank"] === 1;

            return `
                <tr class="${isWinner ? 'winner-row' : ''}">
                    <td>
                        <span class="badge ${isWinner ? 'badge-winner' : 'badge-public'}">#${m["Combined Rank"]}</span>
                    </td>
                    <td style="font-weight: 700;">${m.method} ${isWinner ? '🏆' : ''}</td>
                    <td>${m["Average Latency"]} ms</td>
                    <td>$${m["Infrastructure Cost"]}</td>
                    <td>${m["Resource Utilization"]}%</td>
                    <td>${m["Compliance Satisfaction Rate"]}%</td>
                    <td>${m["SLA Satisfaction Rate"]}%</td>
                    <td style="font-weight: 700; font-size: 1rem; color: ${isWinner ? '#fbbf24' : 'var(--text-main)'};">${m["Combined Score"]}</td>
                    <td>
                        <span class="badge ${pareto.pareto_efficient ? 'badge-edge' : 'badge-private'}">
                            ${pareto.pareto_efficient ? 'PARETO OPTIMAL' : 'DOMINATED'}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");

        renderAnalyticsCharts();
    }

    // Chart.js Analytics Renderer
    function renderAnalyticsCharts() {
        if (!simulationResult) return;

        const methods = simulationResult.scoreMetrics.map(m => m.method);
        const scores = simulationResult.scoreMetrics.map(m => m["Combined Score"]);
        const latencies = simulationResult.scoreMetrics.map(m => m["Average Latency"]);
        const costs = simulationResult.scoreMetrics.map(m => m["Infrastructure Cost"]);
        const compliances = simulationResult.scoreMetrics.map(m => m["Compliance Satisfaction Rate"]);
        const slas = simulationResult.scoreMetrics.map(m => m["SLA Satisfaction Rate"]);
        const utils = simulationResult.scoreMetrics.map(m => m["Resource Utilization"]);

        // Chart 1: Combined Score Comparison
        createOrUpdateChart("chart-combined-score", "bar", {
            labels: methods,
            datasets: [{
                label: "Combined Score (0-100)",
                data: scores,
                backgroundColor: ["#f59e0b", "#3b82f6", "#6366f1", "#06b6d4", "#10b981"]
            }]
        }, "Combined Score Comparison");

        // Chart 2: Latency vs Cost Trade-off
        createOrUpdateChart("chart-latency-cost", "bar", {
            labels: methods,
            datasets: [
                { label: "Avg Latency (ms)", data: latencies, backgroundColor: "#3b82f6", yAxisID: "y" },
                { label: "Total Cost ($)", data: costs, backgroundColor: "#6366f1", yAxisID: "y1" }
            ]
        }, "Latency vs Cost Trade-Off", true);

        // Chart 3: Compliance & SLA Rates
        createOrUpdateChart("chart-compliance-sla", "bar", {
            labels: methods,
            datasets: [
                { label: "Compliance Rate (%)", data: compliances, backgroundColor: "#10b981" },
                { label: "SLA Satisfaction (%)", data: slas, backgroundColor: "#06b6d4" }
            ]
        }, "Compliance & SLA Satisfaction Rate (%)");

        // Chart 4: Utilization
        createOrUpdateChart("chart-utilization", "bar", {
            labels: methods,
            datasets: [{
                label: "Resource Utilization (%)",
                data: utils,
                backgroundColor: "#8b5cf6"
            }]
        }, "Resource Utilization (%)");
    }

    function createOrUpdateChart(canvasId, type, data, title, dualAxis = false) {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }

        const ctx = document.getElementById(canvasId).getContext("2d");
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, color: '#f8fafc', font: { size: 14, weight: 'bold' } },
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        };

        if (dualAxis) {
            options.scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                ticks: { color: '#94a3b8' },
                grid: { drawOnChartArea: false }
            };
        }

        chartInstances[canvasId] = new Chart(ctx, { type, data, options });
    }

    // Workload Trace Explorer Renderer
    function renderWorkloadTraces() {
        if (!simulationResult) return;
        const query = workloadSearchInput.value.toLowerCase().trim();

        const filtered = simulationResult.workloads.filter(w =>
            w.workload_id.toLowerCase().includes(query) ||
            w.source.toLowerCase().includes(query) ||
            w.dataset_id.toLowerCase().includes(query)
        );

        workloadTraceBody.innerHTML = filtered.map(w => `
            <tr>
                <td style="font-family: var(--font-mono); font-weight: 600;">${w.workload_id}</td>
                <td>${w.source}</td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${w.dataset_id}</td>
                <td>${w.gpu_requirement}</td>
                <td>${w.cpu_requirement}</td>
                <td>${w.memory_demand_gb}</td>
                <td>${w.execution_duration_s}s</td>
                <td>P${w.priority_level}</td>
                <td>${w.latency_threshold_ms}ms</td>
                <td>${w.data_size_mb} MB</td>
                <td><span class="badge badge-public">${w.required_compliance}</span></td>
            </tr>
        `).join("");
    }

    workloadSearchInput.addEventListener("input", renderWorkloadTraces);

    // Export CSV Handler
    exportCsvBtn.addEventListener("click", () => {
        if (!simulationResult) return;
        const rows = simulationResult.scoreMetrics;
        const headers = Object.keys(rows[0]).filter(k => k !== "usageStats");

        let csv = headers.join(",") + "\n";
        rows.forEach(r => {
            csv += headers.map(h => `"${r[h]}"`).join(",") + "\n";
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `simulation_results_seed${simulationResult.workloads.length}.csv`;
        a.click();
    });

    // Initial Setup Initialization
    updateWeightNormalization();
    renderTierTable();

    // Auto-run initial simulation on launch
    executeSimulation();

});
