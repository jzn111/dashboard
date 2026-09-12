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

$('#retry-btn').on('click', () => loadData());

loadData();
