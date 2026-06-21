/**
 * KGEngine — 知识图谱力导向渲染引擎
 * 依赖: D3.js v7+
 *
 * 用法:
 *   const kg = new KGEngine('#kg-svg', { onNodeClick: d => console.log(d) });
 *   kg.render({ nodes: [...], links: [...] });
 *   kg.focusNode('node_id');
 *   kg.destroy();
 */
class KGEngine {

    /**
     * @param {string} svgSelector - SVG 元素的 CSS 选择器
     * @param {Object} [opts]
     * @param {Object} [opts.colorMap]     - type → fill color
     * @param {Object} [opts.radiusMap]    - type → radius
     * @param {Object} [opts.typeLabels]   - type → 显示名
     * @param {Function} [opts.onNodeClick] - (nodeData) => void
     * @param {Function} [opts.onEditNode]  - (nodeData) => void, 编修按钮回调
     * @param {Function} [opts.onBgClick]   - () => void, 点击空白区域
     * @param {boolean} [opts.showDetailPanel=true] - 是否内置详情浮窗
     * @param {boolean} [opts.showEdgeLabels=true]  - 是否显示边标签
     * @param {string} [opts.filterRootType='root'] - 排除的节点 type
     */
    constructor(svgSelector, opts = {}) {
        this.svgSelector = svgSelector;
        this.opts = Object.assign({
            colorMap: {
                worldview: '#2dd4bf',
                character: '#fb7185',
                scene:     '#fb923c',
                prop:      '#818cf8',
                root:      '#3b82f6'
            },
            radiusMap: {
                worldview: 8,
                character: 8,
                scene:     8,
                prop:      8,
                root:      15
            },
            typeLabels: {
                worldview: '世界观',
                character: '角色',
                scene:     '场景',
                prop:      '道具',
                root:      '中心设定'
            },
            typeBgColors: {
                worldview: 'bg-teal-500',
                character: 'bg-rose-500',
                scene:     'bg-orange-500',
                prop:      'bg-indigo-500',
                root:      'bg-blue-500'
            },
            onNodeClick: null,
            onEditNode: null,
            onBgClick: null,
            showDetailPanel: true,
            showEdgeLabels: true,
            filterRootType: 'root',
        }, opts);

        // ── Physics constants ──
        this.BASE_OFF       = 10;
        this.MAX_LAB_OFF    = 40;
        this.PAD            = 4;
        this.RADIAL_RESIST  = 3;
        this.COULOMB_K      = 800;
        this.MIN_DIST       = 5;
        this.BARB_LEN       = 10;
        this.ARROW_OFFSET   = 6;
        this.PAIR_SHIFT     = 3;
        this.K_BASE         = 0.02;
        this.LINK_DISTANCE   = 130;

        // ── State ──
        this.simulation = null;
        this.svg = null;
        this.activeSelectedNode = null;
        this._resizeHandler = null;
        this._detailPanel = null;
        this._renderGen = 0;
        this._pendingRender = null;
    }

    // ═══════════════════════════════════════════
    //  Public API
    // ═══════════════════════════════════════════

    /**
     * 渲染知识图谱
     * @param {Object} data - { nodes: [{id, name, type, desc}], links: [{source, target, label?}] }
     */
    render(data) {
        this.destroy();
        const gen = ++this._renderGen;

        const svgEl = document.querySelector(this.svgSelector);
        if (!svgEl) return;

        // 如果容器尺寸为 0（display:none / 布局未完成），延迟到下一帧
        if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) {
            if (this._pendingRender) cancelAnimationFrame(this._pendingRender);
            this._pendingRender = requestAnimationFrame(() => {
                this._pendingRender = null;
                if (this._renderGen === gen) this.render(data);
            });
            return;
        }

        // 深拷贝原始输入数据，防止 D3 forceLink 的原地突变影响源数据
        const rawNodes = (data.nodes || []).map(d => ({ id: d.id, name: d.name, type: d.type, desc: d.desc }));
        const rawLinks = (data.links || []).map(d => ({
            source: typeof d.source === 'object' ? d.source.id : d.source,
            target: typeof d.target === 'object' ? d.target.id : d.target,
            label: d.label || ''
        }));

        // 过滤根节点
        const filteredNodes = rawNodes.filter(n => n.type !== this.opts.filterRootType);
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredLinks = rawLinks.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

        // 创建节点对象，显式初始化所有数值属性
        const nodes = filteredNodes.map((d, i) => ({
            id: d.id, name: d.name, type: d.type, desc: d.desc,
            x: 0, y: 0, vx: 0, vy: 0
        }));
        const links = filteredLinks;

        this.svg = d3.select(this.svgSelector);
        this.svg.selectAll('*').remove();

        const width  = svgEl.clientWidth  || 600;
        const height = svgEl.clientHeight || 400;

        // 给节点设置初始位置在圆环上，加随机抖动防止零距离碰撞导致仿真发散
        const n = nodes.length;
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / n;
            const r = Math.min(width, height) * 0.3;
            const jitter = (Math.random() - 0.5) * 20;
            node.x = width / 2 + r * Math.cos(angle) + jitter;
            node.y = height / 2 + r * Math.sin(angle) + jitter;
        });
        const g = this.svg.append('g');

        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([0.3, 3])
            .on('zoom', e => g.attr('transform', e.transform));
        this.svg.call(zoom);

        // ── Links ──
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const linkGroups = g.append('g')
            .selectAll('.link-group')
            .data(links)
            .join('g')
            .attr('class', 'link-group');
        linkGroups.append('polyline').attr('class', 'link-line').attr('fill', 'none')
            .attr('points', d => {
                const s = nodeMap.get(d.source);
                const t = nodeMap.get(d.target);
                if (!s || !t || !isFinite(s.x) || !isFinite(t.x)) return '0,0 0,0 0,0';
                return `${s.x},${s.y} ${t.x},${t.y} ${t.x},${t.y}`;
            });

        // ── Edge labels ──
        let linkLabels = null;
        if (this.opts.showEdgeLabels) {
            const linkLabelGroup = g.append('g').attr('class', 'link-labels-layer');
            linkLabels = linkLabelGroup.selectAll('.link-label-group')
                .data(links.filter(d => d.label))
                .join('g')
                .attr('class', 'link-label-group');
            linkLabels.append('rect').attr('class', 'link-label-bg')
                .attr('height', 14).attr('rx', 3).attr('ry', 3);
            linkLabels.append('text').attr('class', 'link-label')
                .attr('text-anchor', 'middle').attr('dy', '0.35em')
                .text(d => d.label);
        }

        // ── Nodes ──
        const nodeGroups = g.append('g')
            .selectAll('.node')
            .data(nodes)
            .join('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', (e, d) => this._dragstarted(e, d))
                .on('drag',  (e, d) => this._dragged(e, d))
                .on('end',   (e, d) => this._dragended(e, d)));

        const cm = this.opts.colorMap;
        const rm = this.opts.radiusMap;

        nodeGroups.append('circle')
            .attr('r', d => rm[d.type] || 8)
            .attr('fill', d => cm[d.type] || '#94a3b8')
            .style('filter', 'none');

        nodeGroups.append('text')
            .attr('dy', 17)
            .attr('text-anchor', 'middle')
            .text(d => d.name);

        // ── Interactions ──
        nodeGroups.on('mouseover', (e, d) => {
            d3.select(e.currentTarget).select('circle')
                .attr('r', (rm[d.type] || 8) * 1.4)
                .attr('stroke-width', 2.5);
            this._highlightLinks(linkGroups, linkLabels, d.id, true);
        }).on('mouseout', (e, d) => {
            d3.select(e.currentTarget).select('circle')
                .attr('r', rm[d.type] || 8)
                .attr('stroke-width', 1.5);
            this._highlightLinks(linkGroups, linkLabels, null, false);
        });

        nodeGroups.on('click', (e, d) => {
            e.stopPropagation();
            this.activeSelectedNode = d;
            if (this.opts.onNodeClick) this.opts.onNodeClick(d);
            if (this.opts.showDetailPanel) this._showDetailPanel(d);
        });

        this.svg.on('click', () => {
            this.activeSelectedNode = null;
            if (this.opts.onBgClick) this.opts.onBgClick();
            if (this.opts.showDetailPanel) this._hideDetailPanel();
        });

        // ── Detail panel ──
        if (this.opts.showDetailPanel) {
            this._createDetailPanel();
        }

        // ── Build edge lookup ──
        const edgeKeySet = new Set(links.map(l => l.source + '→' + l.target));

        // ── Degree map (并联弹簧) ──
        const degree = {};
        links.forEach(l => {
            degree[l.source] = (degree[l.source] || 0) + 1;
            degree[l.target] = (degree[l.target] || 0) + 1;
        });

        // ── Side hash ──
        function sideHash(a, b) {
            const s = a < b ? a + '|' + b : b + '|' + a;
            let h = 0;
            for (let k = 0; k < s.length; k++) h = ((h << 5) - h + s.charCodeAt(k)) | 0;
            return (h & 1) === 0 ? 1 : -1;
        }

        // ── Simulation ──
        const _kb = this.K_BASE;
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id)
                .distance(this.LINK_DISTANCE)
                .strength(l => {
                    const sid = typeof l.source === 'object' ? l.source.id : l.source;
                    const tid = typeof l.target === 'object' ? l.target.id : l.target;
                    return ((degree[sid] || 1) + (degree[tid] || 1)) * _kb;
                }))
            .force('charge', d3.forceManyBody().strength(-220))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide().radius(d => (rm[d.type] || 8) * 2.5));

        // ── Tick ──
        const self = this;
        this.simulation.on('tick', () => {
            // 如果已被新一次 render() 取代，停止旧 tick
            if (self._renderGen !== gen) { this.simulation.stop(); return; }

            // D3 在调用此回调前已更新位置（x += vx * decay）。
            // 若力导致发散，将失控节点弹回画布中心并清除速度。
            const maxPos = Math.max(width, height) * 2;
            for (let i = 0; i < nodes.length; i++) {
                const nd = nodes[i];
                if (!isFinite(nd.x) || !isFinite(nd.y) ||
                    nd.x > maxPos || nd.x < -maxPos || nd.y > maxPos || nd.y < -maxPos) {
                    nd.x = width / 2 + (Math.random() - 0.5) * 40;
                    nd.y = height / 2 + (Math.random() - 0.5) * 40;
                    nd.vx = 0; nd.vy = 0;
                }
            }
            // Links + barbs
            linkGroups.each(function(d) {
                const src = typeof d.source === 'object' ? d.source : nodeMap.get(d.source);
                const tgt = typeof d.target === 'object' ? d.target : nodeMap.get(d.target);
                if (!src || !tgt || !isFinite(src.x) || !isFinite(tgt.x)) return;
                const sid = src.id || d.source;
                const tid = tgt.id || d.target;
                let sx = src.x, sy = src.y;
                let tx = tgt.x, ty = tgt.y;
                const dx = tx - sx, dy = ty - sy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / dist, uy = dy / dist;
                const nx = -uy, ny = ux;

                if (edgeKeySet.has(tid + '→' + sid)) {
                    sx += nx * self.PAIR_SHIFT; sy += ny * self.PAIR_SHIFT;
                    tx += nx * self.PAIR_SHIFT; ty += ny * self.PAIR_SHIFT;
                }

                const r = rm[tgt.type] || 8;
                const shorten = r + self.ARROW_OFFSET;
                const endX = tx - ux * shorten;
                const endY = ty - uy * shorten;

                const barbX = endX - ux * self.BARB_LEN - uy * self.BARB_LEN * 0.5;
                const barbY = endY - uy * self.BARB_LEN + ux * self.BARB_LEN * 0.5;

                d3.select(this).select('.link-line')
                    .attr('points', `${sx},${sy} ${endX},${endY} ${barbX},${barbY}`);
            });

            nodeGroups.attr('transform', d => {
                if (!isFinite(d.x) || !isFinite(d.y)) { d.x = width / 2; d.y = height / 2; d.vx = 0; d.vy = 0; }
                return `translate(${d.x}, ${d.y})`;
            });

            // Edge labels
            if (linkLabels) {
                self._tickLabels(linkLabels, links, edgeKeySet, sideHash);
            }
        });

        this.simulation.alpha(0.8).restart();

        // ── Resize ──
        this._resizeHandler = () => {
            if (!this.simulation || this._renderGen !== gen) return;
            const w = svgEl.clientWidth;
            const h = svgEl.clientHeight;
            this.simulation.force('center', d3.forceCenter(w / 2, h / 2));
            this.simulation.alpha(0.2).restart();
        };
        window.addEventListener('resize', this._resizeHandler);
    }

    /**
     * 聚焦到指定节点（高亮关联边，缩放飞入）
     */
    focusNode(nodeId) {
        if (!this.svg || !this.simulation) return;
        const rm = this.opts.radiusMap;
        const target = this.simulation.nodes().find(n => n.id === nodeId);
        if (!target) return;

        d3.selectAll('.node circle')
            .attr('r', d => d.id === nodeId ? (rm[d.type] || 8) * 1.5 : (rm[d.type] || 8))
            .attr('stroke-width', d => d.id === nodeId ? 3 : 1.5);

        this._highlightLinks(
            d3.selectAll('.link-group'),
            d3.selectAll('.link-label-group'),
            nodeId, true
        );

        const container = document.querySelector(this.svgSelector);
        const w = container.clientWidth, h = container.clientHeight;
        const scale = 1.5;
        const tx = w / 2 - target.x * scale;
        const ty = h / 2 - target.y * scale;
        this.svg.transition().duration(600).call(
            d3.zoom().transform,
            d3.zoomIdentity.translate(tx, ty).scale(scale)
        );

        this.activeSelectedNode = target;
        if (this.opts.onNodeClick) this.opts.onNodeClick(target);
        if (this.opts.showDetailPanel) this._showDetailPanel(target);
    }

    /**
     * 销毁引擎，清理所有资源
     */
    destroy() {
        if (this._pendingRender) { cancelAnimationFrame(this._pendingRender); this._pendingRender = null; }
        if (this.simulation) { this.simulation.stop(); this.simulation = null; }
        if (this.svg) { this.svg.selectAll('*').remove(); this.svg.on('click', null); }
        if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); this._resizeHandler = null; }
        if (this._detailPanel) { this._detailPanel.remove(); this._detailPanel = null; }
        this.activeSelectedNode = null;
    }

    // ═══════════════════════════════════════════
    //  Private: Tick — Edge label layout (电势能场)
    // ═══════════════════════════════════════════

    _tickLabels(linkLabels, links, edgeKeySet, sideHash) {
        const self = this;
        const PAD = this.PAD;
        const BO = this.BASE_OFF;
        const MO = this.MAX_LAB_OFF;
        const RR = this.RADIAL_RESIST;
        const CK = this.COULOMB_K;
        const MD = this.MIN_DIST;
        const PS = this.PAIR_SHIFT;

        // Step 1: geometry
        linkLabels.each(function(d) {
            const src = typeof d.source === 'object' ? d.source : null;
            const tgt = typeof d.target === 'object' ? d.target : null;
            if (!src || !tgt || !isFinite(src.x) || !isFinite(tgt.x)) return;
            let sx = src.x, sy = src.y;
            let tx = tgt.x, ty = tgt.y;
            const dx = tx - sx, dy = ty - sy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist, uy = dy / dist;
            const nx = -uy, ny = ux;
            const sid = typeof d.source === 'object' ? d.source.id : d.source;
            const tid = typeof d.target === 'object' ? d.target.id : d.target;
            if (edgeKeySet.has(tid + '→' + sid)) {
                sx += nx * PS; sy += ny * PS;
                tx += nx * PS; ty += ny * PS;
            }
            d._mx = (sx + tx) / 2; d._my = (sy + ty) / 2;
            d._ux = ux; d._uy = uy;
            d._nx = nx; d._ny = ny;
            d._side = sideHash(sid, tid);
            d._bx = d._mx + nx * BO * d._side;
            d._by = d._my + ny * BO * d._side;
            if (d._labDx === undefined) { d._labDx = 0; d._labDy = 0; }
            d._labDx *= 0.9; d._labDy *= 0.9;
        });

        // Step 2: measure bboxes
        linkLabels.attr('transform', d => `translate(${d._mx}, ${d._my})`);
        const entries = [];
        linkLabels.each(function(d) {
            const textEl = d3.select(this).select('text').node();
            const rectEl = d3.select(this).select('rect').node();
            if (!textEl) return;
            const tb = textEl.getBBox();
            if (rectEl) {
                d3.select(rectEl)
                    .attr('x', tb.x - 4).attr('y', tb.y - 2)
                    .attr('width', tb.width + 8).attr('height', tb.height + 4);
            }
            entries.push({ d, hw: (tb.width + 8) / 2 + PAD, hh: (tb.height + 4) / 2 + PAD });
        });

        // Step 3: 电势能斥力
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const a = entries[i], b = entries[j];
                const ax = a.d._bx + a.d._labDx, ay = a.d._by + a.d._labDy;
                const bx = b.d._bx + b.d._labDx, by = b.d._by + b.d._labDy;
                const dx = ax - bx, dy = ay - by;
                const dist = Math.sqrt(dx * dx + dy * dy) || MD;
                const force = CK / (dist * dist);
                const vnx = dx / dist, vny = dy / dist;
                function aniso(px, py, dObj) {
                    const axial  = px * dObj._ux + py * dObj._uy;
                    const radial = px * dObj._nx + py * dObj._ny;
                    return {
                        x: dObj._ux * axial + dObj._nx * (radial / RR),
                        y: dObj._uy * axial + dObj._ny * (radial / RR)
                    };
                }
                const fa = aniso(vnx, vny, a.d);
                const fb = aniso(-vnx, -vny, b.d);
                a.d._labDx += fa.x * force; a.d._labDy += fa.y * force;
                b.d._labDx += fb.x * force; b.d._labDy += fb.y * force;
            }
        }

        // Clamp
        linkLabels.each(function(d) {
            const off = Math.sqrt(d._labDx * d._labDx + d._labDy * d._labDy);
            if (off > MO) { d._labDx *= MO / off; d._labDy *= MO / off; }
        });

        // Step 4: apply
        linkLabels.attr('transform', d =>
            `translate(${d._bx + d._labDx}, ${d._by + d._labDy})`);
    }

    // ═══════════════════════════════════════════
    //  Private: Link highlight
    // ═══════════════════════════════════════════

    _highlightLinks(linkGroups, linkLabels, nodeId, on) {
        const isRelated = l => {
            if (!on) return false;
            const sid = typeof l.source === 'object' ? l.source.id : l.source;
            const tid = typeof l.target === 'object' ? l.target.id : l.target;
            return sid === nodeId || tid === nodeId;
        };

        linkGroups.each(function(l) {
            const sel = d3.select(this).select('.link-line');
            sel.style('stroke-opacity', isRelated(l) ? 0.95 : 0.3)
               .style('stroke', isRelated(l) ? '#3b82f6' : '#94a3b8')
               .style('stroke-width', isRelated(l) ? 2.5 : 1.5);
        });

        if (linkLabels) {
            linkLabels.select('text')
                .style('fill', l => isRelated(l) ? '#1e40af' : '#94a3b8')
                .style('font-weight', l => isRelated(l) ? '700' : '500');
        }
    }

    // ═══════════════════════════════════════════
    //  Private: Drag
    // ═══════════════════════════════════════════

    _dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }
    _dragged(event, d) {
        d.fx = event.x; d.fy = event.y;
    }
    _dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }

    // ═══════════════════════════════════════════
    //  Private: Detail panel (built-in)
    // ═══════════════════════════════════════════

    _createDetailPanel() {
        if (this._detailPanel) this._detailPanel.remove();
        const svgEl = document.querySelector(this.svgSelector);
        const parent = svgEl.parentElement;
        if (!parent) return;
        parent.style.position = 'relative';

        const panel = document.createElement('div');
        panel.id = 'kg-node-detail-panel';
        panel.style.cssText = `
            position:absolute;top:16px;left:16px;z-index:10;width:220px;
            background:rgba(255,255,255,0.9);backdrop-filter:blur(12px);
            border-radius:16px;border:1px solid rgba(226,232,240,0.8);
            padding:14px;box-shadow:0 8px 32px rgba(0,0,0,0.08);
            display:none;flex-direction:column;gap:8px;transition:opacity 0.25s;
        `;
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <span id="kg-detail-type" style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;color:#fff;text-transform:uppercase;letter-spacing:0.05em">设定</span>
                <button id="kg-detail-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;padding:2px;line-height:1">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div id="kg-detail-name" style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.3">节点名称</div>
            <div id="kg-detail-desc" style="font-size:11px;color:#64748b;line-height:1.5;max-height:80px;overflow-y:auto">节点描述</div>
            <div style="height:1px;background:#f1f5f9"></div>
            <button id="kg-detail-edit" style="width:100%;text-align:center;font-size:11px;font-weight:700;color:#3b82f6;background:transparent;border:1px solid rgba(59,130,246,0.3);border-radius:8px;padding:6px 0;cursor:pointer;transition:background 0.15s">编修该设定</button>
        `;
        parent.appendChild(panel);
        this._detailPanel = panel;

        panel.querySelector('#kg-detail-close').onclick = () => this._hideDetailPanel();
        panel.querySelector('#kg-detail-edit').onclick = () => {
            if (this.activeSelectedNode && this.opts.onEditNode) {
                this.opts.onEditNode(this.activeSelectedNode);
            }
        };
    }

    _showDetailPanel(d) {
        if (!this._detailPanel) return;
        const tl = this.opts.typeLabels;
        const tc = this.opts.typeBgColors;
        const badge = this._detailPanel.querySelector('#kg-detail-type');
        badge.textContent = tl[d.type] || '设定';
        badge.style.background = ({
            worldview: '#2dd4bf', character: '#fb7185',
            scene: '#fb923c', prop: '#818cf8', root: '#3b82f6'
        })[d.type] || '#94a3b8';
        this._detailPanel.querySelector('#kg-detail-name').textContent = d.name;
        this._detailPanel.querySelector('#kg-detail-desc').textContent = d.desc || '暂无描述。';
        this._detailPanel.style.display = 'flex';
    }

    _hideDetailPanel() {
        if (this._detailPanel) this._detailPanel.style.display = 'none';
        this.activeSelectedNode = null;
    }
}

// Export for module / global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KGEngine;
} else {
    window.KGEngine = KGEngine;
}
