// 初始化变量
let data;
let margin = { top: 40, right: 30, bottom: 60, left: 60 };
let width = 800 - margin.left - margin.right;
let height = 500 - margin.top - margin.bottom;

// 初始化SVG
const svg = d3
  .select('#chart')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

// 创建比例尺
const xScale = d3.scaleBand().range([0, width]).padding(0.1);

const yScale = d3.scaleLinear().range([height, 0]);

// 创建坐标轴
const xAxis = d3.axisBottom(xScale);
const yAxis = d3.axisLeft(yScale);

// 添加坐标轴组
svg
  .append('g')
  .attr('class', 'x-axis')
  .attr('transform', `translate(0,${height})`);

svg.append('g').attr('class', 'y-axis');

// 添加网格线
svg
  .append('g')
  .attr('class', 'grid')
  .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(''));

// 添加标题
svg
  .append('text')
  .attr('x', width / 2)
  .attr('y', -10)
  .attr('text-anchor', 'middle')
  .style('font-size', '16px')
  .text('数据可视化图表');

// 添加Y轴标签
svg
  .append('text')
  .attr('transform', 'rotate(-90)')
  .attr('y', -margin.left + 15)
  .attr('x', -height / 2)
  .attr('text-anchor', 'middle')
  .text('数值');

// 创建工具提示
const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

// 生成示例数据
function generateData() {
  const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  return categories.map((category) => ({
    category: category,
    value: Math.floor(Math.random() * 100) + 20,
  }));
}

// 初始化图表
function initChart() {
  data = generateData();

  // 更新比例尺域
  xScale.domain(data.map((d) => d.category));
  yScale.domain([0, d3.max(data, (d) => d.value)]);

  // 更新坐标轴
  svg.select('.x-axis').call(xAxis);

  svg.select('.y-axis').call(yAxis);

  // 绑定数据到柱状图
  const bars = svg.selectAll('.bar').data(data);

  // 进入选择 - 创建新元素
  bars
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (d) => xScale(d.category))
    .attr('y', height)
    .attr('width', xScale.bandwidth())
    .attr('height', 0)
    .on('mouseover', function (event, d) {
      tooltip
        .style('opacity', 1)
        .html(`<strong>${d.category}</strong><br>数值: ${d.value}`)
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');

      d3.select(this).style('fill', '#e74c3c');
    })
    .on('mouseout', function () {
      tooltip.style('opacity', 0);
      d3.select(this).style('fill', null);
    })
    .transition()
    .duration(800)
    .attr('y', (d) => yScale(d.value))
    .attr('height', (d) => height - yScale(d.value));

  // 更新选择 - 更新现有元素
  bars
    .transition()
    .duration(800)
    .attr('x', (d) => xScale(d.category))
    .attr('width', xScale.bandwidth())
    .attr('y', (d) => yScale(d.value))
    .attr('height', (d) => height - yScale(d.value));

  // 退出选择 - 移除多余元素
  bars
    .exit()
    .transition()
    .duration(500)
    .attr('y', height)
    .attr('height', 0)
    .remove();
}

// 添加动画效果
function animateBars() {
  svg
    .selectAll('.bar')
    .transition()
    .duration(300)
    .attr('y', (d) => yScale(d.value) - 10)
    .attr('height', (d) => height - yScale(d.value) + 10)
    .transition()
    .duration(300)
    .attr('y', (d) => yScale(d.value))
    .attr('height', (d) => height - yScale(d.value));
}

// 事件监听
document.getElementById('update-btn').addEventListener('click', () => {
  data = generateData();

  // 更新比例尺域
  xScale.domain(data.map((d) => d.category));
  yScale.domain([0, d3.max(data, (d) => d.value)]);

  // 更新坐标轴
  svg.select('.x-axis').transition().duration(800).call(xAxis);

  svg.select('.y-axis').transition().duration(800).call(yAxis);

  // 更新网格线
  svg
    .select('.grid')
    .transition()
    .duration(800)
    .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(''));

  // 更新柱状图
  const bars = svg.selectAll('.bar').data(data);

  bars
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (d) => xScale(d.category))
    .attr('y', height)
    .attr('width', xScale.bandwidth())
    .attr('height', 0)
    .on('mouseover', function (event, d) {
      tooltip
        .style('opacity', 1)
        .html(`<strong>${d.category}</strong><br>数值: ${d.value}`)
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');

      d3.select(this).style('fill', '#e74c3c');
    })
    .on('mouseout', function () {
      tooltip.style('opacity', 0);
      d3.select(this).style('fill', null);
    })
    .transition()
    .duration(800)
    .attr('y', (d) => yScale(d.value))
    .attr('height', (d) => height - yScale(d.value));

  bars
    .transition()
    .duration(800)
    .attr('x', (d) => xScale(d.category))
    .attr('width', xScale.bandwidth())
    .attr('y', (d) => yScale(d.value))
    .attr('height', (d) => height - yScale(d.value));

  bars
    .exit()
    .transition()
    .duration(500)
    .attr('y', height)
    .attr('height', 0)
    .remove();

  animateBars();
});

document.getElementById('reset-btn').addEventListener('click', initChart);

// 响应窗口大小变化
window.addEventListener('resize', initChart);

// 初始化图表
initChart();
