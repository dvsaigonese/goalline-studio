export class ChartEngine {
    constructor(canvasId) {
        this.ctx = document.getElementById(canvasId).getContext('2d');
        this.myChart = null;
    }

    render(chartType, labels, datasets, maxScale) {
        if (this.myChart) this.myChart.destroy();

        // ĐÃ FIX: Không làm tròn lên chục nữa. 
        // Lấy chính xác con số kịch kim (Ví dụ 114.28) để ép thanh nền mờ cắt đúng tại đỉnh của thanh đậm nhất!
        // Nếu các chỉ số đều thấp hơn 100, thì lấy 100 làm chuẩn nền.
        const finalMax = maxScale < 100 ? 100 : maxScale;

        if (chartType === 'radar') {
            this.myChart = new Chart(this.ctx, {
                type: 'radar',
                data: { labels, datasets: datasets },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        r: {
                            min: 0, max: finalMax,
                            angleLines: { color: 'rgba(0,0,0,0.1)' },
                            grid: { color: 'rgba(0,0,0,0.08)', circular: true },
                            pointLabels: { 
                                font: { size: 11, weight: '700' }, padding: 10,
                                color: (ctx) => {
                                    const actualDataset = ctx.chart.data.datasets[0]; 
                                    return actualDataset?.labelColors?.[ctx.index] || '#111';
                                }
                            },
                            ticks: { display: false }
                        }
                    },
                    plugins: { 
                        legend: { display: false },
                        datalabels: { display: false } 
                    }
                }
            });
        } 
        else if (chartType === 'bar') {
            const barBgColors = datasets[0].barColors || ['#6366f1'];
            
            const backgroundBenchmarksPlugin = {
                id: 'backgroundBenchmarks',
                beforeDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    const xAxis = chart.scales.x;
                    const meta = chart.getDatasetMeta(0);
                    
                    if (!meta || !meta.data || meta.data.length === 0) return;
                    
                    ctx.save();
                    meta.data.forEach((bar, index) => {
                        const y = bar.y - bar.height / 2;
                        const xStart = xAxis.getPixelForValue(0);
                        
                        // Lúc này xAxis.max chính xác bằng finalMax (ví dụ 114.28).
                        // Thanh mờ sẽ dài BẰNG KHÍT thanh đậm nhất.
                        const xEnd = xAxis.getPixelForValue(xAxis.max); 
                        
                        ctx.fillStyle = hexToRgba(barBgColors[index], 0.12); 
                        ctx.fillRect(xStart, y, xEnd - xStart, bar.height);
                    });
                    ctx.restore();
                }
            };

            this.myChart = new Chart(this.ctx, {
                type: 'bar',
                data: { labels, datasets },
                plugins: [backgroundBenchmarksPlugin, window.ChartDataLabels], 
                options: {
                    responsive: true, maintainAspectRatio: false,
                    indexAxis: 'y', 
                    layout: { padding: { right: 35 } }, 
                    scales: {
                        x: { min: 0, max: finalMax, display: false },
                        y: { 
                            grid: { display: false },
                            border: { display: false }, 
                            ticks: { font: { size: 12, weight: '700' }, color: '#111' }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: (ctx) => ctx.dataset.data[ctx.dataIndex] < 15 ? 'right' : 'left',
                            color: (ctx) => ctx.dataset.data[ctx.dataIndex] < 15 ? '#111' : '#fff',
                            offset: 6,
                            font: { weight: 'bold', size: 12 },
                            formatter: (val, ctx) => {
                                const realVal = ctx.dataset.realData[ctx.dataIndex];
                                return Number.isInteger(realVal) ? realVal : parseFloat(realVal).toFixed(2);
                            }
                        }
                    }
                }
            });
            
            this.myChart.data.datasets[0].backgroundColor = barBgColors;
        }
    }
}

export function hexToRgba(hex, alpha) {
    var c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3) c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return `rgba(99, 102, 241, ${alpha})`;
}