// app.js — 任务清单 jQuery 版（对照课堂作业五的原生 DOM 写法）
// 状态：唯一数据源是 tasks 数组，界面只是它的投影
let tasks = JSON.parse(localStorage.getItem('jquery-tasks') || '[]');
let filter = 'all'; // all | active | done

const save = () => localStorage.setItem('jquery-tasks', JSON.stringify(tasks));

// 统一渲染：先清空 ul，再按当前过滤条件重建 li
const render = () => {
  const $list = $('#task-list').empty();
  const shown = tasks.filter(t => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  if (shown.length === 0) {
    $list.append('<li class="empty">没有符合条件的任务</li>');
    return;
  }

  // 链式调用：创建 li → 加内容 → 挂到 ul；文本用 .text() 设置防转义问题
  shown.forEach(t => {
    const $li = $('<li></li>').toggleClass('done', t.done).attr('data-id', t.id);
    $('<span class="text"></span>').text(t.text).appendTo($li);
    $('<button type="button" class="delete">删除</button>').appendTo($li);
    $list.append($li);
  });
};

// 添加（submit 必须 preventDefault，否则页面刷新，数据闪没）
$('#add-form').on('submit', function (e) {
  e.preventDefault();
  const text = $('#task-input').val().trim();
  if (text === '') {
    $('#tip').text('任务名不能为空').css('color', '#c00');
    return;
  }
  $('#tip').text('');
  tasks.push({ id: Date.now(), text: text, done: false });
  save();
  $('#task-input').val('');
  render();
});

// 事件委托：li 上的点击统一在父元素 ul 上监听（jQuery 内置委托写法）
$('#task-list').on('click', 'li', function () {
  const id = Number($(this).attr('data-id'));
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    save();
    render();
  }
});

// 删除按钮：stopPropagation 防止冒泡到 li 又触发完成切换
$('#task-list').on('click', '.delete', function (e) {
  e.stopPropagation();
  const id = Number($(this).closest('li').attr('data-id'));
  tasks = tasks.filter(t => t.id !== id);
  save();
  render();
});

// 过滤切换
$('.filters').on('click', 'button', function () {
  filter = $(this).data('filter');
  $('.filters button').removeClass('active');
  $(this).addClass('active');
  render();
});

render();
