let chart = null;

const LEVEL_COLORS = ['#2ECC71', '#82E0AA', '#F4D03F', '#E67E22', '#E74C3C'];

function scoreColor(avgLevel) {
  return LEVEL_COLORS[Math.round(avgLevel) - 1] || '#3498DB';
}

export function renderChart(canvas) {
  chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{ label: '자세 점수', data: [], backgroundColor: [], borderColor: [], borderWidth: 1, borderRadius: 4 }]
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
  const colors = new Array(24).fill('rgba(255,255,255,0.05)');
  const borders = new Array(24).fill('rgba(255,255,255,0.1)');
  hourlyData.forEach(({ hour, avg_score, avg_level }) => {
    const h = +hour;
    data[h] = Math.round(avg_score);
    const c = scoreColor(avg_level);
    colors[h] = c + '66';
    borders[h] = c;
  });
  chart.data.labels = Array.from({ length: 24 }, (_, i) => `${i}시`);
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].backgroundColor = colors;
  chart.data.datasets[0].borderColor = borders;
  chart.update();
}

export function updateChartDaily(dailyData, dayLabels) {
  if (!chart) return;
  const map = Object.fromEntries(dailyData.map(d => [d.day, d]));
  const data = dayLabels.map(l => map[l] ? Math.round(map[l].avg_score) : null);
  const colors = dayLabels.map(l => map[l] ? scoreColor(map[l].avg_level) + '66' : 'rgba(255,255,255,0.05)');
  const borders = dayLabels.map(l => map[l] ? scoreColor(map[l].avg_level) : 'rgba(255,255,255,0.1)');
  chart.data.labels = dayLabels.map(l => l.slice(5).replace('-', '/'));
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].backgroundColor = colors;
  chart.data.datasets[0].borderColor = borders;
  chart.update();
}
