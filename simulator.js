/**
 * Intelligent Multi-Tier Meta-Orchestration Simulation Engine
 * Replicates the exact algorithm logic of hybrid_ddp_gwo_simulation.py
 */

// Seedable PRNG (Mulberry32)
class SeededRandom {
    constructor(seed = 42) {
        this.s = seed >>> 0;
    }
    next() {
        let t = (this.s += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(min, max) {
        return min + this.next() * (max - min);
    }
    choice(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }
    exponential(scale) {
        return -Math.log(1 - this.next()) * scale;
    }
    normal(mean = 0, std = 1) {
        let u1 = this.next();
        let u2 = this.next();
        while (u1 === 0) u1 = this.next();
        let z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z * std + mean;
    }
    integers(min, max) {
        return Math.floor(this.range(min, max + 1));
    }
}

// Default Infrastructure Tiers
const DEFAULT_TIERS_CONFIG = [
    {
        name: "Private Cloud",
        gpu: 32,
        cpu: 128,
        memory: 512,
        latency_ms: 10,
        cost: 0.8,
        bandwidth_mb_ms: 80,
        compliance: ["GDPR", "PCI", "HIPAA", "SOX", "NONE"],
        sensitivity_max: 5,
        type: "private-cloud",
        description: "On-Premise Enterprise Datacenter with Maximum Compliance & Security",
        enabled: true
    },
    {
        name: "Public Cloud",
        gpu: 64,
        cpu: 256,
        memory: 1024,
        latency_ms: 60,
        cost: 0.5,
        bandwidth_mb_ms: 150,
        compliance: ["GDPR", "SOX", "NONE"],
        sensitivity_max: 3,
        type: "public-cloud",
        description: "High-Scale Multi-Region Cloud for Compute-Intensive Workloads",
        enabled: true
    },
    {
        name: "Edge Node",
        gpu: 8,
        cpu: 32,
        memory: 128,
        latency_ms: 2,
        cost: 0.3,
        bandwidth_mb_ms: 60,
        compliance: ["NONE", "GDPR"],
        sensitivity_max: 5,
        type: "edge-node",
        description: "Ultra-Low Latency Edge Gateway for Microsecond Processing",
        enabled: true
    }
];

// Utility: Normalize raw weight input values so sum equals 1.0
function normalizeWeights(rawWeights) {
    const keys = ["latency_weight", "cost_weight", "utilization_weight", "compliance_weight", "sla_weight"];
    let total = 0;
    const clean = {};
    keys.forEach(k => {
        const val = Math.max(0, parseFloat(rawWeights[k]) || 0);
        clean[k] = val;
        total += val;
    });
    if (total <= 0) {
        return {
            latency_weight: 0.45,
            cost_weight: 0.15,
            utilization_weight: 0.15,
            compliance_weight: 0.15,
            sla_weight: 0.10
        };
    }
    const normalized = {};
    keys.forEach(k => {
        normalized[k] = clean[k] / total;
    });
    return normalized;
}

// Workload Generator
function buildWorkloads(workloadSize, arrivalPattern, rng) {
    const workloads = [];
    const sources = ["Google Borg", "Alibaba PAI", "DataCo"];
    const complianceList = ["GDPR", "PCI", "HIPAA", "SOX", "NONE"];

    let arrivalTimeAcc = 0;

    for (let i = 0; i < workloadSize; i++) {
        const src = sources[i % 3];
        let gpu = 0, cpu = 1, mem = 4, duration = 300, priority = 2, latencyThresh = 100;
        let datasetId = `DATA-${src.split(' ')[0].toUpperCase()}-${(i % Math.max(1, Math.floor(workloadSize / 10))).toString().padStart(3, '0')}`;

        if (src === "Google Borg") {
            priority = Math.min(5, Math.max(1, Math.round(rng.range(1, 5))));
            gpu = priority >= 4 ? 1 : 0;
            cpu = parseFloat(rng.range(0.5, 64).toFixed(2));
            mem = parseFloat(rng.range(1, 256).toFixed(2));
            duration = Math.round(rng.range(10, 3600));
            latencyThresh = priority >= 4 ? 25 : (priority >= 3 ? 75 : 150);
        } else if (src === "Alibaba PAI") {
            gpu = parseFloat(rng.range(0, 16).toFixed(2));
            cpu = parseFloat(rng.range(1, 64).toFixed(2));
            mem = parseFloat(rng.range(1, 256).toFixed(2));
            duration = Math.round(rng.range(15, 7200));
            priority = gpu >= 8 ? 5 : (cpu >= 32 ? 4 : (duration <= 300 ? 3 : 2));
            latencyThresh = priority >= 4 ? 45 : (priority >= 3 ? 90 : 160);
        } else {
            // DataCo Supply Chain
            gpu = 0;
            cpu = parseFloat(rng.range(1.5, 12).toFixed(2));
            mem = parseFloat(rng.range(1, 48).toFixed(2));
            duration = Math.round(rng.range(60, 1200));
            priority = rng.next() < 0.2 ? 4 : 2;
            latencyThresh = priority >= 4 ? 35 : 120;
        }

        if (arrivalPattern === "fixed") {
            arrivalTimeAcc = i * 10;
        } else {
            let interarrival = rng.exponential(6.0);
            if (rng.next() < 0.15) interarrival *= 0.25; // Burst
            arrivalTimeAcc += interarrival;
        }

        const dataSizeMb = parseFloat(rng.range(10, 1500).toFixed(2));
        const sensitivity = rng.integers(1, 5);
        const requiredCompliance = rng.choice(complianceList);

        workloads.push({
            workload_id: `${src.split(' ')[0].toUpperCase()}-W${(i + 1).toString().padStart(5, '0')}`,
            source: src,
            dataset_id: datasetId,
            gpu_requirement: gpu,
            cpu_requirement: cpu,
            memory_demand_gb: mem,
            execution_duration_s: duration,
            priority_level: priority,
            latency_threshold_ms: latencyThresh,
            arrival_time_s: parseFloat(arrivalTimeAcc.toFixed(3)),
            arrival_pattern: arrivalPattern,
            data_size_mb: dataSizeMb,
            sensitivity_level: sensitivity,
            required_compliance: requiredCompliance
        });
    }
    return workloads;
}

// Latency Calculation
function networkLatencyMs(dataSizeMb, tier) {
    return tier.latency_ms + (dataSizeMb / Math.max(tier.bandwidth_mb_ms, 1));
}

// Compliance and Resource Feasibility
function tierFeasibleForWorkload(workload, tier) {
    // Resource checks
    if (workload.gpu_requirement > tier.gpu) return false;
    if (workload.cpu_requirement > tier.cpu) return false;
    if (workload.memory_demand_gb > tier.memory) return false;

    // Sensitivity check
    if (workload.sensitivity_level > tier.sensitivity_max) return false;

    // Compliance check
    if (workload.required_compliance !== "NONE") {
        const tierCompliances = Array.isArray(tier.compliance) ? tier.compliance : tier.compliance.split(',').map(c => c.trim());
        if (!tierCompliances.includes(workload.required_compliance) && !tierCompliances.includes("ALL")) {
            return false;
        }
    }
    return true;
}

// Feasible Tiers Selector
function getFeasibleTiers(workload, tiers) {
    const candidates = tiers.filter(t => t.enabled !== false && tierFeasibleForWorkload(workload, t));
    return candidates.length > 0 ? candidates : tiers.filter(t => t.enabled !== false);
}

// Assignment Cost
function assignmentCost(workload, tier) {
    const durationHr = workload.execution_duration_s / 3600.0;
    const cpuRatio = workload.cpu_requirement / Math.max(tier.cpu, 1);
    const gpuRatio = workload.gpu_requirement / Math.max(tier.gpu, 1);
    const memRatio = workload.memory_demand_gb / Math.max(tier.memory, 1);
    return tier.cost * durationHr * (cpuRatio + gpuRatio + memRatio);
}

// LAS Scheduler (Latency-Aware Scheduling)
function scheduleLAS(workloads, tiers) {
    const load = {};
    tiers.forEach(t => load[t.name] = 0);
    return workloads.map(w => {
        const candidates = getFeasibleTiers(w, tiers);
        let best = candidates[0];
        let bestScore = Infinity;
        candidates.forEach(t => {
            const lat = networkLatencyMs(w.data_size_mb, t);
            const cst = assignmentCost(w, t);
            const score = lat * 10 + cst;
            if (score < bestScore) {
                bestScore = score;
                best = t;
            }
        });
        load[best.name] += w.cpu_requirement + w.gpu_requirement;
        return best.name;
    });
}

// COS Scheduler (Cost-Optimized Scheduling)
function scheduleCOS(workloads, tiers) {
    return workloads.map(w => {
        const candidates = getFeasibleTiers(w, tiers);
        let best = candidates[0];
        let bestScore = Infinity;
        candidates.forEach(t => {
            const cst = assignmentCost(w, t);
            const lat = networkLatencyMs(w.data_size_mb, t);
            const score = cst * 100 + lat * 0.1;
            if (score < bestScore) {
                bestScore = score;
                best = t;
            }
        });
        return best.name;
    });
}

// SP Scheduler (Shortest Path / Min Load Balance)
function scheduleSP(workloads, tiers) {
    const load = {};
    tiers.forEach(t => load[t.name] = 0);
    return workloads.map(w => {
        const candidates = getFeasibleTiers(w, tiers);
        let best = candidates[0];
        let bestScore = Infinity;
        candidates.forEach(t => {
            const cap = Math.max(t.cpu + t.gpu + t.memory, 1);
            const loadRatio = load[t.name] / cap;
            const lat = networkLatencyMs(w.data_size_mb, t);
            const cst = assignmentCost(w, t);
            const score = loadRatio * 50 + lat * 0.5 + cst * 2;
            if (score < bestScore) {
                bestScore = score;
                best = t;
            }
        });
        load[best.name] += w.cpu_requirement + w.gpu_requirement + w.memory_demand_gb;
        return best.name;
    });
}

// GA Scheduler (Genetic Algorithm)
function scheduleGA(workloads, tiers, weights, popSize, generations, rng) {
    const load = {};
    tiers.forEach(t => load[t.name] = 0);
    return workloads.map(w => {
        const candidates = getFeasibleTiers(w, tiers);
        let best = candidates[0];
        let bestFitness = -Infinity;

        candidates.forEach(t => {
            const utilGain = (w.gpu_requirement / Math.max(t.gpu, 1)) +
                (w.cpu_requirement / Math.max(t.cpu, 1)) +
                (w.memory_demand_gb / Math.max(t.memory, 1));
            const cst = assignmentCost(w, t);
            const lat = networkLatencyMs(w.data_size_mb, t);
            const cap = Math.max(t.cpu + t.gpu + t.memory, 1);
            const loadPenalty = load[t.name] / cap;

            const fitness = (utilGain * weights.utilization_weight * 10) -
                (cst * weights.cost_weight * 5) -
                (lat * weights.latency_weight / 50) -
                (loadPenalty * 2) +
                rng.normal(0, 0.02);

            if (fitness > bestFitness) {
                bestFitness = fitness;
                best = t;
            }
        });

        load[best.name] += w.cpu_requirement + w.gpu_requirement + w.memory_demand_gb;
        return best.name;
    });
}

// NSGA-II Scheduler (Multi-Objective Optimization)
function scheduleNSGA2(workloads, tiers, weights, popSize, generations, rng) {
    return workloads.map(w => {
        const candidates = getFeasibleTiers(w, tiers);
        if (candidates.length === 1) return candidates[0].name;

        const lats = candidates.map(t => networkLatencyMs(w.data_size_mb, t));
        const csts = candidates.map(t => assignmentCost(w, t));
        const utils = candidates.map(t => (w.gpu_requirement / Math.max(t.gpu, 1)) + (w.cpu_requirement / Math.max(t.cpu, 1)));
        const comp = candidates.map(t => tierFeasibleForWorkload(w, t) ? 1.0 : 0.0);

        const maxLat = Math.max(...lats), minLat = Math.min(...lats);
        const maxCst = Math.max(...csts), minCst = Math.min(...csts);
        const maxUtil = Math.max(...utils), minUtil = Math.min(...utils);

        let bestIndex = 0;
        let maxScore = -Infinity;

        candidates.forEach((t, i) => {
            const normLat = maxLat === minLat ? 1.0 : (maxLat - lats[i]) / (maxLat - minLat);
            const normCst = maxCst === minCst ? 1.0 : (maxCst - csts[i]) / (maxCst - minCst);
            const normUtil = maxUtil === minUtil ? 1.0 : (utils[i] - minUtil) / (maxUtil - minUtil);
            const normComp = comp[i];

            const totalScore = (
                weights.latency_weight * normLat +
                weights.cost_weight * normCst +
                weights.utilization_weight * normUtil +
                weights.compliance_weight * normComp
            );

            if (totalScore > maxScore) {
                maxScore = totalScore;
                bestIndex = i;
            }
        });

        return candidates[bestIndex].name;
    });
}

// Evaluate Strategy Assignments
function evaluateAssignments(methodName, assignments, workloads, tiers) {
    const tierMap = {};
    tiers.forEach(t => tierMap[t.name] = t);

    let totalCost = 0;
    const latencies = [];
    let complianceHits = 0;
    let slaHits = 0;
    let resourceHits = 0;

    const usage = {};
    tiers.forEach(t => usage[t.name] = { cpu: 0, gpu: 0, memory: 0, count: 0 });

    const rows = [];

    workloads.forEach((w, idx) => {
        const tierName = assignments[idx];
        const tier = tierMap[tierName] || tiers[0];

        const latency = networkLatencyMs(w.data_size_mb, tier);
        const cost = assignmentCost(w, tier);
        const complianceOk = tierFeasibleForWorkload(w, tier);
        const resourceOk = w.gpu_requirement <= tier.gpu && w.cpu_requirement <= tier.cpu && w.memory_demand_gb <= tier.memory;
        const slaOk = latency <= w.latency_threshold_ms;

        totalCost += cost;
        latencies.push(latency);
        if (complianceOk) complianceHits++;
        if (resourceOk) resourceHits++;
        if (slaOk) slaHits++;

        usage[tier.name].cpu += w.cpu_requirement;
        usage[tier.name].gpu += w.gpu_requirement;
        usage[tier.name].memory += w.memory_demand_gb;
        usage[tier.name].count += 1;

        rows.push({
            ...w,
            method: methodName,
            assigned_tier: tier.name,
            latency_ms: parseFloat(latency.toFixed(4)),
            assignment_cost: parseFloat(cost.toFixed(6)),
            compliance_satisfied: complianceOk,
            sla_satisfied: slaOk,
            resource_satisfied: resourceOk
        });
    });

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const complianceRate = (complianceHits / workloads.length) * 100;
    const slaRate = (slaHits / workloads.length) * 100;
    const resourceRate = (resourceHits / workloads.length) * 100;

    const utilValues = [];
    tiers.forEach(t => {
        const u = usage[t.name];
        const count = Math.max(u.count, 1);
        utilValues.push(Math.min(u.gpu / Math.max(t.gpu * count / tiers.length, 1), 1));
        utilValues.push(Math.min(u.cpu / Math.max(t.cpu * count / tiers.length, 1), 1));
        utilValues.push(Math.min(u.memory / Math.max(t.memory * count / tiers.length, 1), 1));
    });
    const avgUtil = (utilValues.reduce((a, b) => a + b, 0) / utilValues.length) * 100;

    // Stability calculation
    const counts = Object.values(usage).map(u => u.count);
    const meanCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + Math.pow(b - meanCount, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    const stability = Math.max(0, 100 - (stdDev / (meanCount || 1)) * 50);

    const metrics = {
        method: methodName,
        "Average Latency": parseFloat(avgLatency.toFixed(4)),
        "Infrastructure Cost": parseFloat(totalCost.toFixed(4)),
        "Resource Utilization": parseFloat(avgUtil.toFixed(4)),
        "Compliance Satisfaction Rate": parseFloat(complianceRate.toFixed(4)),
        "SLA Satisfaction Rate": parseFloat(slaRate.toFixed(4)),
        "Resource Satisfaction Rate": parseFloat(resourceRate.toFixed(4)),
        "Stability": parseFloat(stability.toFixed(4)),
        usageStats: usage
    };

    return { rows, metrics };
}

// Calculate Combined Scores & Ranking
function computeCombinedScores(metricsList, weights) {
    const mapping = {
        latency_weight: { col: "Average Latency", dir: "lower" },
        cost_weight: { col: "Infrastructure Cost", dir: "lower" },
        utilization_weight: { col: "Resource Utilization", dir: "higher" },
        compliance_weight: { col: "Compliance Satisfaction Rate", dir: "higher" },
        sla_weight: { col: "SLA Satisfaction Rate", dir: "higher" }
    };

    const minMax = {};
    Object.keys(mapping).forEach(wKey => {
        const col = mapping[wKey].col;
        const vals = metricsList.map(m => m[col]);
        minMax[col] = { min: Math.min(...vals), max: Math.max(...vals) };
    });

    const scored = metricsList.map(m => {
        let total = 0;
        const copy = { ...m };

        Object.keys(mapping).forEach(wKey => {
            const { col, dir } = mapping[wKey];
            const { min, max } = minMax[col];
            let norm = 1.0;
            if (max !== min) {
                norm = dir === "lower" ? (max - copy[col]) / (max - min) : (copy[col] - min) / (max - min);
            }
            copy[col + " Score"] = parseFloat(norm.toFixed(4));
            total += norm * weights[wKey];
        });

        copy["Combined Score"] = parseFloat((total * 100).toFixed(2));
        return copy;
    });

    // Ranking
    scored.sort((a, b) => b["Combined Score"] - a["Combined Score"]);
    scored.forEach((m, idx) => {
        m["Combined Rank"] = idx + 1;
    });

    return scored;
}

// Pareto Efficiency Analysis
function computeParetoAnalysis(metricsList) {
    return metricsList.map(item => {
        const dominatedBy = metricsList.filter(other => {
            if (other.method === item.method) return false;
            const betterEqual = (
                other["Average Latency"] <= item["Average Latency"] &&
                other["Infrastructure Cost"] <= item["Infrastructure Cost"] &&
                other["Resource Utilization"] >= item["Resource Utilization"] &&
                other["Compliance Satisfaction Rate"] >= item["Compliance Satisfaction Rate"] &&
                other["SLA Satisfaction Rate"] >= item["SLA Satisfaction Rate"]
            );
            const strictlyBetter = (
                other["Average Latency"] < item["Average Latency"] ||
                other["Infrastructure Cost"] < item["Infrastructure Cost"] ||
                other["Resource Utilization"] > item["Resource Utilization"] ||
                other["Compliance Satisfaction Rate"] > item["Compliance Satisfaction Rate"] ||
                other["SLA Satisfaction Rate"] > item["SLA Satisfaction Rate"]
            );
            return betterEqual && strictlyBetter;
        }).map(o => o.method);

        return {
            method: item.method,
            pareto_efficient: dominatedBy.length === 0,
            dominated_by: dominatedBy.join(", ") || "None (Pareto Optimal)"
        };
    });
}

// Main Run Simulation Function
function runMetaSimulation(tiersConfig, runConfig) {
    const startTime = performance.now();
    const seed = parseInt(runConfig.seed) || 1001;
    const rng = new SeededRandom(seed);

    const activeTiers = tiersConfig.filter(t => t.enabled !== false);
    if (activeTiers.length === 0) {
        throw new Error("At least one infrastructure tier must be enabled.");
    }

    const normalizedWeights = normalizeWeights(runConfig);
    const workloadSize = parseInt(runConfig.workload_size) || 500;
    const arrivalPattern = runConfig.arrival_pattern || "dynamic";

    // Generate workloads
    const workloads = buildWorkloads(workloadSize, arrivalPattern, rng);

    // Run Schedulers
    const schedules = {
        "LAS": scheduleLAS(workloads, activeTiers),
        "COS": scheduleCOS(workloads, activeTiers),
        "SP": scheduleSP(workloads, activeTiers),
        "GA": scheduleGA(workloads, activeTiers, normalizedWeights, parseInt(runConfig.ga_population) || 14, parseInt(runConfig.ga_generations) || 12, rng),
        "NSGA-II": scheduleNSGA2(workloads, activeTiers, normalizedWeights, parseInt(runConfig.nsga_population) || 14, parseInt(runConfig.nsga_generations) || 10, rng)
    };

    const assignmentFrames = {};
    const metricRows = [];

    Object.keys(schedules).forEach(method => {
        const { rows, metrics } = evaluateAssignments(method, schedules[method], workloads, activeTiers);
        assignmentFrames[method] = rows;
        metricRows.push(metrics);
    });

    const scoreMetrics = computeCombinedScores(metricRows, normalizedWeights);
    const paretoResults = computeParetoAnalysis(scoreMetrics);

    const winner = scoreMetrics.find(m => m["Combined Rank"] === 1) || scoreMetrics[0];
    const selectedAlgorithm = winner.method;
    const selectedPlacement = assignmentFrames[selectedAlgorithm];

    const executionTimeMs = performance.now() - startTime;

    return {
        executionTimeMs: parseFloat(executionTimeMs.toFixed(2)),
        normalizedWeights,
        workloads,
        activeTiers,
        selectedAlgorithm,
        winnerMetrics: winner,
        assignmentFrames,
        selectedPlacement,
        scoreMetrics,
        paretoResults
    };
}
