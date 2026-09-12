// app.js — 个人消费记账看板（自主实践）
// 主题：消费记账。数据流：fetch 本地 JSON → 状态处理 → 卡片/图表渲染
const state = { data: null };

// ?empty=1 时加载空数据文件，方便演示"空数据"状态，不用临时改 JSON
const isEmptyDemo = new URLSearchParams(location.search).get('empty') === '1';
const DATA_URL = isEmptyDemo ? 'data/spending.empty.json' : 'data/spending.json';

const showStatus = (msg, withRetry) => {
  $('#status-text').text(msg);
  $('#retry-btn').toggle(withRetry === true);
  $('#status').show();
};

const loadData = async () => {
  showStatus('加载中...', false);
  try {
    // 本地文件几乎瞬间返回，这里短暂停留让"加载中"状态能被观察和截图
    await new Promise(resolve => setTimeout(resolve, 450));

    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const data = await response.json();

    // 状态三：请求成功但没有数据——显示提示而不是白屏
    if (!data.series || data.series.length === 0) {
      showStatus('暂无数据（当前加载的是空数据文件 spending.empty.json）', false);
      return;
    }

    state.data = data;
    $('#sub-title').text(data.title + ' · 单位：' + data.unit);
    $('#source-note').text('数据来源：' + data.source + ' · 时间范围：2026年1-6月');
    $('#status').hide();
    renderCards(data);
    renderBarChart(data);
    renderLineChart(data);
  } catch (error) {
    // 网络断开 / 文件不存在 / JSON 解析失败，三种错误都落到这里
    showStatus('加载失败：' + error.message + '（可在开发者工具 Network 勾 Offline 复现）', true);
  }
};

// 统计卡片：总支出、月均、最高月份、数据点数
const renderCards = (data) => {
  const monthlyTotals = data.months.map((m, i) =>
    data.series.reduce((sum, s) => sum + s.counts[i], 0)
  );
  const grandTotal = monthlyTotals.reduce((a, b) => a + b, 0);
  const avg = Math.round(grandTotal / data.months.length);
  const maxIdx = monthlyTotals.indexOf(Math.max(...monthlyTotals));
  const pointCount = data.series.length * data.months.length;

  const cards = [
    { label: '上半年总支出', value: grandTotal + ' ' + data.unit },
    { label: '月均支出', value: avg + ' ' + data.unit },
    { label: '支出最高月份', value: data.months[maxIdx] + '（' + monthlyTotals[maxIdx] + data.unit + '）' },
    { label: '数据点数', value: pointCount + ' 条（' + data.series.length + '类×' + data.months.length + '月）' }
  ];

  cards.forEach(c => {
    $('#cards').append(`
      <div class="col-md-3 col-6">
        <div class="card">
          <div class="card-body">
            <h3 class="card-title h6 text-muted">${c.label}</h3>
            <p class="card-text fs-5 mb-0">${c.value}</p>
          </div>
        </div>
      </div>
    `);
  });
};

// 图表一：ECharts 柱状图——回答"哪个月、哪类花得多"，分类比较用柱状图
let barChart = null;
const renderBarChart = (data) => {
  if (barChart === null) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
  }
  barChart.setOption({
    title: { text: '各月分类支出对比（单位：元）', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { data: data.months },
    yAxis: { name: '元' },
    series: data.series.map(s => ({
      name: s.category,
      type: 'bar',
      data: s.counts
    }))
  });
};

// 图表二：Chart.js 折线图——回答"半年总支出怎么变化"，时间趋势用折线图
// 数据表达红线：y 轴从 0 开始，不截断坐标轴夸大波动
let lineChart = null;
const renderLineChart = (data) => {
  if (lineChart !== null) {
    lineChart.destroy();
  }
  const monthlyTotals = data.months.map((m, i) =>
    data.series.reduce((sum, s) => sum + s.counts[i], 0)
  );
  const ctx = document.querySelector('#line-chart');
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.months,
      datasets: [{
        label: '月度总支出',
        data: monthlyTotals,
        borderWidth: 2,
        backgroundColor: 'rgba(13,110,253,.15)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, title: { display: true, text: '单位：元' } }
      },
      plugins: {
        title: { display: true, text: '月度总支出趋势（数据来源：' + data.source + '）' }
      }
    }
  });
};

window.addEventListener('resize', () => {
  if (barChart) barChart.resize();
});

$('#retry-btn').on('click', () => loadData());

loadData();
