// app.js — 图书馆数据看板
// 第一步：fetch 异步加载本地 JSON + 四种界面状态 + 统计卡片
const state = { data: null };

const showStatus = (msg, withRetry) => {
  $('#status-text').text(msg);
  $('#retry-btn').toggle(withRetry === true);
  $('#status').show();
};

const loadData = async () => {
  showStatus('加载中...', false);
  try {
    const response = await fetch('data/books.json');
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const data = await response.json();
    if (data.series.length === 0) {
      showStatus('暂无数据', false);
      return;
    }
    state.data = data;
    $('#sub-title').text(data.title + ' · 数据来源：课程统一数据集');
    $('#status').hide();
    renderCards(data);
    renderBarChart(data);
    renderLineChart(data);
  } catch (error) {
    // 网络层失败（断网）或解析层失败（JSON损坏）都进这里
    showStatus('加载失败：' + error.message, true);
  }
};

// 统计卡片：每个品类一张，显示 N 个月累计借阅量
const renderCards = (data) => {
  const months = data.months;
  data.series.forEach(s => {
    const total = s.counts.reduce((sum, n) => sum + n, 0);
    $('#cards').append(`
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h3 class="card-title h6">${s.category}</h3>
            <p class="card-text fs-4">${total}</p>
            <p class="card-text small text-muted">共${months.length}个月累计借阅（册）</p>
          </div>
        </div>
      </div>
    `);
  });
};

// 第二步：ECharts 柱状图——各月各品类借阅量对比
// init 只做一次：容器拿到的图表实例缓存下来，重复加载只 setOption
let barChart = null;
const renderBarChart = (data) => {
  if (barChart === null) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
  }
  barChart.setOption({
    title: { text: '各月各品类借阅量（单位：册）', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { data: data.months },
    yAxis: { name: '册' },
    series: data.series.map(s => ({
      name: s.category,
      type: 'bar',
      data: s.counts
    }))
  });
};

// 第三步：Chart.js 折线图——借阅趋势
// 同一个 canvas 不能重复 new Chart()，重渲染前先 destroy 旧实例
let lineChart = null;
const renderLineChart = (data) => {
  if (lineChart !== null) {
    lineChart.destroy();
  }
  const ctx = document.querySelector('#line-chart');
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.months,
      datasets: data.series.map(s => ({
        label: s.category,
        data: s.counts,
        borderWidth: 1
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, title: { display: true, text: '册' } }
      },
      plugins: {
        title: { display: true, text: '借阅趋势（单位：册）' }
      }
    }
  });
};

// ECharts 不会自动响应窗口变化，拉伸窗口时手动 resize；Chart.js 默认自动
window.addEventListener('resize', () => {
  if (barChart) barChart.resize();
});

// 失败状态下点重试，重新走一遍加载流程
$('#retry-btn').on('click', () => {
  loadData();
});

loadData();
