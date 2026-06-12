// Crypto-themed animated background.
// Three layers: WebGL wave field (flow-field-like), 2D glyph rain, CSS grid mask.
// Waves are autonomous; mouse movement drops a decaying radial ripple.
(function initCryptoBG() {
    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var wavesCanvas = document.getElementById('crypto-bg-waves');
    var rainCanvas = document.getElementById('crypto-bg');

    var waves = setupWaves(wavesCanvas);
    var rain = setupRain(rainCanvas);

    var state = {
        viewW: window.innerWidth,
        viewH: window.innerHeight,
        mouseX: -9999,
        mouseY: -9999,
        smoothMouseX: -9999,
        smoothMouseY: -9999,
        velX: 0,
        velY: 0,
        energy: 0,
        lastX: 0,
        lastY: 0,
        lastTime: 0,
        seen: false,
        startTime: performance.now()
    };

    function resize() {
        state.viewW = window.innerWidth;
        state.viewH = window.innerHeight;
        if (waves) waves.resize(state.viewW, state.viewH);
        if (rain) rain.resize(state.viewW, state.viewH);
    }

    function handleMove(x, y) {
        var now = performance.now();
        if (state.seen) {
            var dt = Math.max(8, now - state.lastTime);
            var rvx = (x - state.lastX) / dt;
            var rvy = (y - state.lastY) / dt;
            state.velX += (rvx - state.velX) * 0.4;
            state.velY += (rvy - state.velY) * 0.4;
        } else {
            state.smoothMouseX = x;
            state.smoothMouseY = y;
        }
        state.lastX = x;
        state.lastY = y;
        state.lastTime = now;
        state.seen = true;
        state.mouseX = x;
        state.mouseY = y;
    }

    window.addEventListener('pointermove', function (e) {
        handleMove(e.clientX, e.clientY);
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
        if (e.touches && e.touches.length) {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    var raf = 0;
    var running = false;

    function start() {
        if (running || reduced) return;
        running = true;
        raf = requestAnimationFrame(tick);
    }
    function stop() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
    }

    function setCssDrift(x, y) {
        var root = document.documentElement;
        root.style.setProperty('--mx', ((x / state.viewW) * 100).toFixed(2) + '%');
        root.style.setProperty('--my', ((y / state.viewH) * 100).toFixed(2) + '%');
    }

    function tick(now) {
        var elapsed = (now - state.startTime) / 1000;

        if (state.seen) {
            state.smoothMouseX += (state.mouseX - state.smoothMouseX) * 0.15;
            state.smoothMouseY += (state.mouseY - state.smoothMouseY) * 0.15;
        }
        state.velX *= 0.93;
        state.velY *= 0.93;
        var speed = Math.sqrt(state.velX * state.velX + state.velY * state.velY);
        var targetEnergy = Math.min(1, speed * 5);
        state.energy += (targetEnergy - state.energy) * 0.18;
        state.energy *= 0.985; // slow decay so ripple fades after idle

        // Drifting focus for the CSS grid mask — autonomous Lissajous
        var driftX = state.viewW * 0.5
            + Math.sin(elapsed * 0.18) * state.viewW * 0.25
            + Math.cos(elapsed * 0.11) * state.viewW * 0.08;
        var driftY = state.viewH * 0.5
            + Math.cos(elapsed * 0.21) * state.viewH * 0.20
            + Math.sin(elapsed * 0.13) * state.viewH * 0.10;
        setCssDrift(driftX, driftY);

        if (waves) waves.render(elapsed, state);
        if (rain) rain.render(state, driftX, driftY);

        raf = requestAnimationFrame(tick);
    }

    resize();
    setCssDrift(state.viewW / 2, state.viewH / 2);

    window.addEventListener('resize', function () {
        stop();
        resize();
        start();
    });
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop();
        else start();
    });

    if (!reduced) start();

    // ============================================================
    // WebGL wave field
    // ============================================================
    function setupWaves(canvas) {
        if (!canvas) return null;
        var gl = null;
        try {
            gl = canvas.getContext('webgl', {
                alpha: true,
                premultipliedAlpha: false,
                antialias: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: false
            }) || canvas.getContext('experimental-webgl');
        } catch (err) { /* no webgl */ }
        if (!gl) return null;

        var vsSrc =
            'attribute vec2 a_pos;' +
            'void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }';

        var fsSrc =
            'precision mediump float;' +
            'uniform vec2 u_res;' +
            'uniform float u_time;' +
            'uniform vec2 u_mouse;' +
            'uniform float u_energy;' +
            '' +
            'float wave(vec2 p, float t) {' +
            '  float w = 0.0;' +
            '  w += sin(p.x * 2.1 + t * 0.35);' +
            '  w += sin(p.y * 2.4 - t * 0.28);' +
            '  w += sin((p.x + p.y) * 1.7 + t * 0.22);' +
            '  w += sin((p.x - p.y * 0.6) * 2.9 - t * 0.18);' +
            '  return w * 0.25;' +
            '}' +
            '' +
            'void main() {' +
            '  vec2 uv = gl_FragCoord.xy / u_res;' +
            '  float aspect = u_res.x / u_res.y;' +
            '  vec2 p = uv * 2.0 - 1.0;' +
            '  p.x *= aspect;' +
            '  float t = u_time;' +
            // Domain warping — drive p through a slow flow field
            '  vec2 warp;' +
            '  warp.x = sin(p.y * 1.3 + t * 0.13) * 0.45 + cos(p.x * 0.6 - t * 0.07) * 0.2;' +
            '  warp.y = cos(p.x * 1.1 - t * 0.11) * 0.40 + sin(p.y * 0.7 + t * 0.05) * 0.2;' +
            '  vec2 pw = p + warp;' +
            '  float w = wave(pw, t);' +
            '  float w2 = wave(pw * 1.8 + 7.3, t * 1.15);' +
            '  w = w * 0.7 + w2 * 0.3;' +
            // Mouse ripple — ring wave decaying with distance, modulated by movement energy
            '  vec2 mNdc;' +
            '  mNdc.x = (u_mouse.x / u_res.x * 2.0 - 1.0) * aspect;' +
            '  mNdc.y = 1.0 - u_mouse.y / u_res.y * 2.0;' +
            '  float d = distance(p, mNdc);' +
            '  float ripple = sin(d * 9.0 - t * 2.4) * exp(-d * 1.6) * u_energy;' +
            '  w += ripple * 0.55;' +
            '  float v = w * 0.5 + 0.5;' +
            // Dark palette — very subtle, UI-friendly
            '  vec3 c1 = vec3(0.004, 0.004, 0.040);' +
            '  vec3 c2 = vec3(0.040, 0.022, 0.105);' +
            '  vec3 c3 = vec3(0.022, 0.060, 0.125);' +
            '  vec3 col = mix(c1, c2, smoothstep(0.0, 0.55, v));' +
            '  col = mix(col, c3, smoothstep(0.55, 1.0, v));' +
            // Soft tint near mouse based on movement energy
            '  col += vec3(0.035, 0.055, 0.090) * u_energy * exp(-d * 2.6);' +
            '  gl_FragColor = vec4(col, 1.0);' +
            '}';

        function compile(type, src) {
            var s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                gl.deleteShader(s);
                return null;
            }
            return s;
        }

        var vs = compile(gl.VERTEX_SHADER, vsSrc);
        var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
        if (!vs || !fs) return null;

        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        // Oversized triangle covering the viewport
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

        var aPos = gl.getAttribLocation(prog, 'a_pos');
        var uRes = gl.getUniformLocation(prog, 'u_res');
        var uTime = gl.getUniformLocation(prog, 'u_time');
        var uMouse = gl.getUniformLocation(prog, 'u_mouse');
        var uEnergy = gl.getUniformLocation(prog, 'u_energy');

        var dpr = 1;

        function resize(w, h) {
            dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
        }

        function render(time, s) {
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(prog);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uTime, time);
            gl.uniform2f(uMouse, s.smoothMouseX * dpr, s.smoothMouseY * dpr);
            gl.uniform1f(uEnergy, s.energy);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        return { resize: resize, render: render };
    }

    // ============================================================
    // 2D glyph rain
    // ============================================================
    function setupRain(canvas) {
        if (!canvas || !canvas.getContext) return null;
        var ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return null;

        var GLYPHS = '0123456789ABCDEF01λφπσΣΔκωξζηψχ⊕⊗⊘⟨⟩∇∞≡≢';
        var FONT_SIZE = 16;

        var viewW = 0, viewH = 0, cols = 0;
        var columns = [];

        function randomGlyph() {
            return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
        }

        function resize(w, h) {
            var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            viewW = w;
            viewH = h;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cols = Math.ceil(w / FONT_SIZE);
            columns = new Array(cols).fill(0).map(function () {
                return {
                    y: Math.random() * h,
                    speed: 0.4 + Math.random() * 1.6,
                    glyph: randomGlyph(),
                    changeIn: Math.floor(Math.random() * 12)
                };
            });
        }

        function render(s, driftX, driftY) {
            ctx.fillStyle = 'rgba(2, 2, 26, 0.14)';
            ctx.fillRect(0, 0, viewW, viewH);
            ctx.font = FONT_SIZE + 'px ui-monospace, "SF Mono", Consolas, monospace';
            ctx.textBaseline = 'top';
            var energyBoost = s.energy;
            for (var i = 0; i < cols; i++) {
                var col = columns[i];
                var x = i * FONT_SIZE;

                // Rain illuminates around the drifting focus
                var dx = x - driftX;
                var dy = col.y - driftY;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var intensity = Math.max(0, 1 - dist / 260);

                if (--col.changeIn <= 0) {
                    col.glyph = randomGlyph();
                    col.changeIn = 3 + Math.floor(Math.random() * 16);
                }

                var r = Math.floor(120 + intensity * 80);
                var g = Math.floor(160 + intensity * 60);
                var b = 230;
                var alphaHead = 0.22 + intensity * 0.28 + energyBoost * 0.05;
                ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alphaHead + ')';
                ctx.fillText(col.glyph, x, col.y);

                var tailAlpha = 0.05 + intensity * 0.14;
                ctx.fillStyle = 'rgba(100, 120, 220, ' + tailAlpha + ')';
                ctx.fillText(col.glyph, x, col.y - FONT_SIZE);

                col.y += col.speed + intensity * 1.0 + energyBoost * 0.3;
                if (col.y > viewH + FONT_SIZE * 4) {
                    col.y = -FONT_SIZE - Math.random() * 220;
                    col.speed = 0.4 + Math.random() * 1.6;
                }
            }
        }

        return { resize: resize, render: render };
    }
})();
