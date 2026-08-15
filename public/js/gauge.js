/**
 * Premium Gauge
 */

function renderGauge(containerEl, score, { size = 260 } = {}) {

    const startAngle = -225;
    const sweep = 270;

    const value = Math.max(0, Math.min(100, score));
    const angle = startAngle + (value / 100) * sweep;

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;

    function polar(cx, cy, r, angle) {
        const rad = (angle - 90) * Math.PI / 180;
        return {
            x: cx + r * Math.cos(rad),
            y: cy + r * Math.sin(rad)
        };
    }

    function arc(cx, cy, r, start, end) {

        const p1 = polar(cx, cy, r, start);
        const p2 = polar(cx, cy, r, end);

        const largeArc = end - start <= 180 ? 0 : 1;

        return `
            M ${p1.x} ${p1.y}
            A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}
        `;
    }

    let color = "#ff5b6e";
    let band = "Getting Started";

    if (value >= 85) {
        color = "#41ff9f";
        band = "Placement Ready";
    }
    else if (value >= 65) {
        color = "#ffb238";
        band = "Almost Ready";
    }
    else if (value >= 40) {
        color = "#ffd166";
        band = "Needs Improvement";
    }

    const needle = polar(cx, cy, r * 0.87, angle);

    containerEl.innerHTML = `

<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">

<defs>

<linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">

<stop offset="0%" stop-color="#ffcf66"/>

<stop offset="100%" stop-color="#ff9d00"/>

</linearGradient>

<filter id="glow">

<feGaussianBlur stdDeviation="4" result="blur"/>

<feMerge>

<feMergeNode in="blur"/>

<feMergeNode in="SourceGraphic"/>

</feMerge>

</filter>

</defs>

<!-- Track -->

<path
d="${arc(cx,cy,r,startAngle,startAngle+sweep)}"
stroke="#20284d"
stroke-width="18"
fill="none"
stroke-linecap="round"/>

<!-- Progress -->

<path
d="${arc(cx,cy,r,startAngle,angle)}"
stroke="url(#gaugeGradient)"
stroke-width="18"
fill="none"
stroke-linecap="round"
filter="url(#glow)"/>

<!-- Needle -->

<line
x1="${cx}"
y1="${cy}"
x2="${needle.x}"
y2="${needle.y}"
stroke="#dfe6ff"
stroke-width="3"
stroke-linecap="round"/>

<!-- Center Glass Circle -->

<circle
cx="${cx}"
cy="${cy}"
r="42"
fill="#1a2140"
stroke="#2c3565"
stroke-width="2"/>

<!-- Center Dot -->

<circle
cx="${cx}"
cy="${cy}"
r="6"
fill="#ffffff"/>

<!-- Score -->

<text
x="${cx}"
y="${cy+45}"
text-anchor="middle"
font-size="46"
font-weight="700"
fill="#ffffff"
font-family="Inter">
${value}
</text>

<!-- /100 -->

<text
x="${cx}"
y="${cy+66}"
text-anchor="middle"
font-size="18"
fill="#8c95b7"
font-family="Inter">
/100
</text>

</svg>

<div style="
margin-top:18px;
font-size:22px;
font-weight:700;
color:${color};
text-align:center;">
${band}
</div>

`;

}