let chart = null;

const LEVEL_COLORS = ['#2ECC71', '#82E0AA', '#F4D03F', '#E67E22', '#E74C3C'];

export function renderChart(canvas) {
  chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}시`),
      datasets: [{
        label: '자세 점수',
        data: new Array(24).fill(null),
        backgroundColor: new Array(24).fill('rgba(52,152,219,0.4)'),
        borderColor: new Array(24).fill('#3498DB'),
        borderWidth: 1, borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
        x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } }
      },
      plugins: { legend: { display: false } },
    }
  });
}

export function updateChart(hourlyData) {
  if (!chart) return;
  const data = new Array(24).fill(null);
  const colors = new Array(24).fill('rgba(52,152,219,0.4)');
  const borders = new Array(24).fill('#3498DB');
  hourlyData.forEach(({ hour, avg_score, avg_level }) => {
    const h = +hour;
    data[h] = Math.round(avg_score);
    const lvColor = LEVEL_COLORS[Math.round(avg_level) - 1] || '#3498DB';
    colors[h] = lvColor + '66';
    borders[h] = lvColor;
  });
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].backgroundColor = colors;
  chart.data.datasets[0].borderColor = borders;
  chart.update();
}
