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
    renderFilters(data);
    renderBarChart(data);
    renderLineChart(data);
    renderPieChart(data);
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

  $('#cards').empty(); // 重试时先清空，避免卡片重复追加
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

// jQuery 交互状态：当前筛选的品类，'all' 表示全部
let activeCategory = 'all';

// 依据数据动态生成筛选按钮（事件委托：点哪个按钮都在父容器上统一处理）
const renderFilters = (data) => {
  const $box = $('#category-filters').empty();
  $box.append('<button type="button" class="btn btn-primary" data-cat="all">全部</button>');
  data.series.forEach(s => {
    $box.append('<button type="button" class="btn btn-outline-primary" data-cat="' + s.category + '">' + s.category + '</button>');
  });
};
$('#category-filters').on('click', 'button', function () {
  activeCategory = $(this).data('cat');
  $('#category-filters button')
    .removeClass('btn-primary').addClass('btn-outline-primary');
  $(this).removeClass('btn-outline-primary').addClass('btn-primary');
  if (state.data) renderBarChart(state.data); // 只重画柱状图，折线/饼图保持全局口径
});

// 图表一：ECharts 柱状图——回答"哪个月、哪类花得多"，分类比较用柱状图
let barChart = null;
const renderBarChart = (data) => {
  const visible = activeCategory === 'all'
    ? data.series
    : data.series.filter(s => s.category === activeCategory);
  if (barChart === null) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
  }
  barChart.setOption({
    title: { text: '各月分类支出对比（单位：元）', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { data: data.months },
    yAxis: { name: '元' },
    series: visible.map(s => ({
      name: s.category,
      type: 'bar',
      data: s.counts
    }))
  }, true); // 第二个参数 true：不与上一次 option 合并，避免筛掉的品类残留
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

// 图表三：ECharts 饼图——回答"各品类占总支出多少"，部分与整体用饼图（4类，适合）
let pieChart = null;
const renderPieChart = (data) => {
  const pieData = data.series.map(s => ({
    name: s.category,
    value: s.counts.reduce((sum, n) => sum + n, 0)
  }));
  if (pieChart === null) {
    pieChart = echarts.init(document.querySelector('#pie-chart'));
  }
  pieChart.setOption({
    title: { text: '上半年各类支出占比（单位：元）', left: 'center' },
    tooltip: { trigger: 'item', formatter: '{b}：{c}元（{d}%）' },
    legend: { bottom: 0 },
    series: [{
      name: '品类占比',
      type: 'pie',
      radius: '60%',
      data: pieData,
      label: { show: true, formatter: '{b}: {d}%' } // 直接显示百分比
    }]
  });
};

window.addEventListener('resize', () => {
  if (barChart) barChart.resize();
  if (pieChart) pieChart.resize();
});

$('#retry-btn').on('click', () => loadData());

loadData();
