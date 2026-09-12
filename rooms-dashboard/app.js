// app.js — 校园自习室实时看板（基于课程统一数据集 rooms.json）
// 数据流：fetch 加载 → 四状态处理 → 卡片/图表/明细表渲染
const state = { data: null };

// ?empty=1 时加载空数据文件，用于演示"空数据"状态
const isEmptyDemo = new URLSearchParams(location.search).get('empty') === '1';
const DATA_URL = isEmptyDemo ? 'data/rooms.empty.json' : 'data/rooms.json';

const showStatus = (msg, withRetry) => {
  $('#status-text').text(msg);
  $('#retry-btn').toggle(withRetry === true);
  $('#status').show();
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + '（' + url + '）');
  }
  return response.json();
};

const loadData = async () => {
  showStatus('加载中...', false);
  try {
    await new Promise(resolve => setTimeout(resolve, 450)); // 让"加载中"状态可观察
    const data = await fetchJson(DATA_URL);

    if (!data.rooms || data.rooms.length === 0) {
      showStatus('暂无数据（当前加载的是空数据文件 rooms.empty.json）', false);
      return;
    }

    state.data = data;
    $('#sub-title').text(data.title + ' · 单位：座');
    $('#source-note').text('数据来源：' + data.source);
    $('#status').hide();

    renderCards(data);
    renderFilters(data);
    renderTable(data);
    renderBarChart(data);
    renderPieChart(data);
  } catch (error) {
    // 断网 / 文件缺失 / JSON 损坏，全部兜到失败状态
    showStatus('加载失败：' + error.message + '（可在 Network 面板勾 Offline 复现）', true);
  }
};

// 按楼栋聚合：总座位、已占用
const aggregateByBuilding = (data) => {
  const map = new Map();
  data.rooms.forEach(r => {
    if (!map.has(r.building)) {
      map.set(r.building, { building: r.building, seats: 0, occupied: 0 });
    }
    const item = map.get(r.building);
    item.seats += r.seats;
    item.occupied += r.occupied;
  });
  return Array.from(map.values());
};

// 统计卡片：自习室数、开放数、总座位、总上座率
const renderCards = (data) => {
  const totalRooms = data.rooms.length;
  const openRooms = data.rooms.filter(r => r.status === '开放').length;
  const totalSeats = data.rooms.reduce((s, r) => s + r.seats, 0);
  const totalOccupied = data.rooms.reduce((s, r) => s + r.occupied, 0);
  const rate = (totalOccupied / totalSeats * 100).toFixed(1);

  const cards = [
    { label: '自习室总数', value: totalRooms + ' 间' },
    { label: '当前开放', value: openRooms + ' 间（维修/闭馆 ' + (totalRooms - openRooms) + ' 间）' },
    { label: '总座位 / 已占用', value: totalSeats + ' / ' + totalOccupied + ' 座' },
    { label: '全校综合上座率', value: rate + '%' }
  ];
  $('#cards').empty();
  cards.forEach(c => {
    $('#cards').append(`
      <div class="col-md-3 col-6">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="card-title h6 text-muted">${c.label}</h3>
            <p class="card-text fs-5 mb-0">${c.value}</p>
          </div>
        </div>
      </div>
    `);
  });
};

// jQuery 交互：楼栋筛选按钮（事件委托，按钮由数据动态生成）
let activeBuilding = 'all';
const renderFilters = (data) => {
  const buildings = Array.from(new Set(data.rooms.map(r => r.building)));
  const $box = $('#building-filters').empty();
  $box.append('<button type="button" class="btn btn-sm btn-primary" data-building="all">全部楼栋</button>');
  buildings.forEach(b => {
    $box.append('<button type="button" class="btn btn-sm btn-outline-primary" data-building="' + b + '">' + b + '</button>');
  });
};
$('#building-filters').on('click', 'button', function () {
  activeBuilding = $(this).data('building');
  $('#building-filters button')
    .removeClass('btn-primary').addClass('btn-outline-primary');
  $(this).removeClass('btn-outline-primary').addClass('btn-primary');
  if (state.data) renderTable(state.data);
});

// 明细表：随筛选条件重画
const statusBadge = (status) => {
  const cls = status === '开放' ? 'text-bg-success'
    : status === '维修' ? 'text-bg-warning'
    : 'text-bg-secondary';
  return '<span class="badge ' + cls + '">' + status + '</span>';
};
const renderTable = (data) => {
  const rooms = activeBuilding === 'all'
    ? data.rooms
    : data.rooms.filter(r => r.building === activeBuilding);
  const $tbody = $('#room-tbody').empty();
  rooms.forEach(r => {
    const rate = r.seats === 0 ? '0.0' : (r.occupied / r.seats * 100).toFixed(1);
    $tbody.append(
      '<tr>' +
        '<td>' + r.name + '</td>' +
        '<td>' + r.building + '</td>' +
        '<td>' + r.floor + '层</td>' +
        '<td>' + r.seats + '</td>' +
        '<td>' + r.occupied + '</td>' +
        '<td>' + rate + '%</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td>' + r.hours + '</td>' +
      '</tr>'
    );
  });
};

// 图表一：ECharts 分组柱状图——各楼"总座位 vs 已占用"谁多谁少，比较用柱
let barChart = null;
const renderBarChart = (data) => {
  const grouped = aggregateByBuilding(data);
  if (barChart === null) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
  }
  barChart.setOption({
    title: { text: '各楼座位与占用对比（单位：座）', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { data: grouped.map(g => g.building) },
    yAxis: { name: '座' },
    series: [
      { name: '总座位', type: 'bar', data: grouped.map(g => g.seats) },
      { name: '已占用', type: 'bar', data: grouped.map(g => g.occupied) }
    ]
  });
};

// 图表二：Chart.js 环形图——各楼已占用座位的占比，部分与整体用饼图类
let pieChart = null;
const renderPieChart = (data) => {
  if (pieChart !== null) {
    pieChart.destroy();
  }
  const grouped = aggregateByBuilding(data);
  const total = grouped.reduce((s, g) => s + g.occupied, 0);
  const ctx = document.querySelector('#pie-chart');
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: grouped.map(g => g.building),
      datasets: [{
        data: grouped.map(g => g.occupied),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: '各楼已占用座位占比（单位：座，数据来源：' + data.source + '）' },
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (item) => {
              const v = item.parsed;
              return item.label + '：' + v + ' 座（' + (v / total * 100).toFixed(1) + '%）';
            }
          }
        }
      }
    }
  });
};

window.addEventListener('resize', () => {
  if (barChart) barChart.resize();
});

$('#retry-btn').on('click', () => loadData());

loadData();
