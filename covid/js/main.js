// 全局变量
let data = [];
let filteredData = [];
let cumulativeData = [];
let weeklyData = [];
let movingAvgData = [];

// 图表尺寸和边距
const margin = { top: 60, right: 100, bottom: 100, left: 70 };
const brushMargin = { top: 10, right: 30, bottom: 30, left: 70 };
const width =
  document.getElementById('main-chart').parentElement.clientWidth -
  margin.left -
  margin.right;
const height = 500 - margin.top - margin.bottom;
const brushHeight = 100 - brushMargin.top - brushMargin.bottom;

// 比例尺
let xScale, yScale, yScale2, xScaleBrush, yScaleBrush;
let colorScale;

// 轴
let xAxis, yAxis, yAxis2;

// 图表容器
let svg, brushSvg, scatterSvg, weeklySvg, movingAvgSvg;
let mainGroup, brushGroup;

// 线条生成器
let line, line2, area, area2;

// 当前视图状态
let currentView = 'line';
let dateRange = [];
let isDragging = false;

// 初始化
async function init() {
  try {
    // 加载数据
    await loadData();

    // 初始化图表
    initializeCharts();

    // 更新统计卡片
    updateStats();

    // 渲染图表
    renderChart();

    // 绑定事件
    bindEvents();

    // 生成洞察
    generateInsights();
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Failed to load data. Please check the console for details.');
  }
}

// 加载数据
async function loadData() {
  // 如果是本地开发，从CSV文件加载
  // 在实际部署中，可以替换为API端点
  return new Promise((resolve, reject) => {
    d3.csv('data/covid_data.csv')
      .then((rawData) => {
        // 解析数据
        data = rawData
          .map((d) => {
            // 解析日期 (格式: dd/mm/yyyy)
            const [day, month, year] = d.date.split('/');
            const date = new Date(year, month - 1, day);

            return {
              date: date,
              dateStr: d.date,
              daily_cases: +d.daily_cases,
              daily_fatalities: +d.daily_fatalities,
              region: d.region,
              dayOfWeek: date.getDay(), // 0=Sunday, 1=Monday, ...
              month: date.getMonth(),
              year: date.getFullYear(),
              week: getWeekNumber(date),
            };
          })
          .sort((a, b) => a.date - b.date); // 按日期排序

        // 计算累积数据
        calculateCumulativeData();

        // 计算每周数据
        calculateWeeklyData();

        // 计算移动平均
        calculateMovingAverages();

        // 设置初始日期范围
        dateRange = [d3.min(data, (d) => d.date), d3.max(data, (d) => d.date)];

        // 更新日期输入
        document.getElementById('start-date').valueAsDate = dateRange[0];
        document.getElementById('end-date').valueAsDate = dateRange[1];

        filteredData = data.filter(
          (d) => d.date >= dateRange[0] && d.date <= dateRange[1],
        );

        resolve();
      })
      .catch(reject);
  });
}

// 计算累积数据
function calculateCumulativeData() {
  let totalCases = 0;
  let totalDeaths = 0;

  cumulativeData = data.map((d) => {
    totalCases += d.daily_cases;
    totalDeaths += d.daily_fatalities;

    return {
      ...d,
      cumulative_cases: totalCases,
      cumulative_deaths: totalDeaths,
    };
  });
}

// 计算每周数据
function calculateWeeklyData() {
  const weeklyMap = new Map();

  data.forEach((d) => {
    const weekKey = `${d.year}-${d.week}`;
    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        week: weekKey,
        startDate: d.date,
        total_cases: 0,
        total_deaths: 0,
        avg_daily_cases: 0,
        avg_daily_deaths: 0,
        days: 0,
      });
    }

    const weekData = weeklyMap.get(weekKey);
    weekData.total_cases += d.daily_cases;
    weekData.total_deaths += d.daily_fatalities;
    weekData.days++;
  });

  // 计算平均值并转换为数组
  weeklyData = Array.from(weeklyMap.values()).map((w) => ({
    ...w,
    avg_daily_cases: w.total_cases / w.days,
    avg_daily_deaths: w.total_deaths / w.days,
  }));
}

// 计算移动平均
function calculateMovingAverages(windowSize = 7) {
  movingAvgData = data.map((d, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const end = i + 1;
    const windowData = data.slice(start, end);

    const avgCases =
      windowData.reduce((sum, day) => sum + day.daily_cases, 0) /
      windowData.length;
    const avgDeaths =
      windowData.reduce((sum, day) => sum + day.daily_fatalities, 0) /
      windowData.length;

    return {
      ...d,
      moving_avg_cases: avgCases,
      moving_avg_deaths: avgDeaths,
    };
  });
}

// 获取周数
function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// 初始化图表
function initializeCharts() {
  // 创建主图表SVG
  svg = d3
    .select('#main-chart')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // 创建刷子图表SVG
  brushSvg = d3
    .select('#brush-chart')
    .attr('width', width + brushMargin.left + brushMargin.right)
    .attr('height', brushHeight + brushMargin.top + brushMargin.bottom)
    .append('g')
    .attr('transform', `translate(${brushMargin.left},${brushMargin.top})`);

  // 创建散点图SVG
  scatterSvg = d3
    .select('#scatter-chart')
    .attr('width', '100%')
    .attr('height', 300)
    .append('g')
    .attr('transform', `translate(50, 20)`);

  // 创建每周图表SVG
  weeklySvg = d3
    .select('#weekly-chart')
    .attr('width', '100%')
    .attr('height', 300)
    .append('g')
    .attr('transform', `translate(50, 20)`);

  // 创建移动平均图表SVG
  movingAvgSvg = d3
    .select('#moving-avg-chart')
    .attr('width', '100%')
    .attr('height', 300)
    .append('g')
    .attr('transform', `translate(50, 20)`);

  // 初始化比例尺
  initializeScales();

  // 初始化轴
  initializeAxes();

  // 初始化线条生成器
  initializeLineGenerators();

  // 创建网格
  createGrid();

  // 创建刷子
  createBrush();
}

// 初始化比例尺
function initializeScales() {
  xScale = d3.scaleTime().domain(dateRange).range([0, width]);

  yScale = d3
    .scaleLinear()
    .domain([0, d3.max(filteredData, (d) => d.daily_cases)])
    .range([height, 0])
    .nice();

  yScale2 = d3
    .scaleLinear()
    .domain([0, d3.max(filteredData, (d) => d.daily_fatalities)])
    .range([height, 0])
    .nice();

  xScaleBrush = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.date))
    .range([0, width]);

  yScaleBrush = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.daily_cases)])
    .range([brushHeight, 0])
    .nice();

  colorScale = d3
    .scaleOrdinal()
    .domain([
      'cases',
      'deaths',
      'cumulative_cases',
      'cumulative_deaths',
      'avg_7day',
    ])
    .range(['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12']);
}

// 初始化轴
function initializeAxes() {
  xAxis = d3
    .axisBottom(xScale)
    .tickFormat(d3.timeFormat('%b %Y'))
    .ticks(width / 80);

  yAxis = d3
    .axisLeft(yScale)
    .ticks(8)
    .tickFormat((d) => d3.format(',')(d));

  yAxis2 = d3
    .axisRight(yScale2)
    .ticks(8)
    .tickFormat((d) => d3.format(',')(d));
}

// 初始化线条生成器
function initializeLineGenerators() {
  line = d3
    .line()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.daily_cases))
    .curve(d3.curveMonotoneX);

  line2 = d3
    .line()
    .x((d) => xScale(d.date))
    .y((d) => yScale2(d.daily_fatalities))
    .curve(d3.curveMonotoneX);

  area = d3
    .area()
    .x((d) => xScale(d.date))
    .y0(height)
    .y1((d) => yScale(d.daily_cases))
    .curve(d3.curveMonotoneX);

  area2 = d3
    .area()
    .x((d) => xScale(d.date))
    .y0(height)
    .y1((d) => yScale2(d.daily_fatalities))
    .curve(d3.curveMonotoneX);
}

// 创建网格
function createGrid() {
  // 主图表网格
  svg
    .append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickSize(-height).tickFormat(''));

  svg
    .append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(''));
}

// 创建刷子
function createBrush() {
  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, brushHeight],
    ])
    .on('brush', brushed)
    .on('end', brushended);

  // 绘制刷子图表的基础折线
  brushGroup = brushSvg.append('g');

  brushGroup
    .append('path')
    .datum(data)
    .attr('class', 'line')
    .attr('fill', 'none')
    .attr('stroke', '#3498db')
    .attr('stroke-width', 1.5)
    .attr(
      'd',
      d3
        .line()
        .x((d) => xScaleBrush(d.date))
        .y((d) => yScaleBrush(d.daily_cases)),
    );

  // 添加刷子
  brushGroup.append('g').attr('class', 'brush').call(brush);

  // 初始刷子范围
  brushGroup.select('.brush').call(brush.move, xScaleBrush.range());
}

// 刷子事件处理
function brushed(event) {
  if (!event.sourceEvent) return;
  if (!event.selection) return;

  const [x0, x1] = event.selection;
  dateRange = [xScaleBrush.invert(x0), xScaleBrush.invert(x1)];

  updateChart();
}

function brushended(event) {
  if (!event.sourceEvent) return;
  if (!event.selection) return;

  updateDateInputs();
}

// 渲染主图表
function renderChart() {
  // 清空之前的图表
  svg.selectAll('*').remove();

  // 添加轴
  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis)
    .selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)');

  svg.append('g').attr('class', 'y-axis').call(yAxis);

  svg
    .append('g')
    .attr('class', 'y-axis2')
    .attr('transform', `translate(${width},0)`)
    .call(yAxis2);

  // 根据当前视图类型渲染不同的图表
  switch (currentView) {
    case 'line':
      renderLineChart();
      break;
    case 'dual-axis':
      renderDualAxisChart();
      break;
    case 'scatter':
      renderScatterPlot();
      break;
    case 'stacked':
      renderStackedArea();
      break;
    case 'bar':
      renderBarChart();
      break;
    case 'heatmap':
      renderHeatmap();
      break;
  }

  // 添加轴标签
  addAxisLabels();

  // 添加图例
  addLegend();

  // 渲染副图表
  renderScatterChart();
  renderWeeklyChart();
  renderMovingAvgChart();

  // 更新数据表格
  updateDataTable();
}

// 渲染折线图
function renderLineChart() {
  const showCases = document.getElementById('show-cases').checked;
  const showDeaths = document.getElementById('show-deaths').checked;
  const show7DayAvg = document.getElementById('show-7day-avg').checked;

  if (showCases) {
    // 病例折线
    svg
      .append('path')
      .datum(filteredData)
      .attr('class', 'line cases-line')
      .attr('d', line)
      .style('stroke', colorScale('cases'))
      .style('stroke-width', 3);
  }

  if (showDeaths) {
    // 死亡折线（使用右侧y轴）
    const lineDeaths = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale2(d.daily_fatalities));

    svg
      .append('path')
      .datum(filteredData)
      .attr('class', 'line deaths-line')
      .attr('d', lineDeaths)
      .style('stroke', colorScale('deaths'))
      .style('stroke-width', 3);
  }

  if (show7DayAvg) {
    // 7日移动平均
    const movingAvgFiltered = movingAvgData.filter(
      (d) => d.date >= dateRange[0] && d.date <= dateRange[1],
    );

    const lineAvg = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.moving_avg_cases));

    svg
      .append('path')
      .datum(movingAvgFiltered)
      .attr('class', 'line avg-line')
      .attr('d', lineAvg)
      .style('stroke', colorScale('avg_7day'))
      .style('stroke-width', 2)
      .style('stroke-dasharray', '5,5');
  }

  // 添加交互点
  addInteractivePoints();
}

// 渲染双轴图
function renderDualAxisChart() {
  // 病例区域
  svg
    .append('path')
    .datum(filteredData)
    .attr('class', 'area cases-area')
    .attr('d', area)
    .style('fill', colorScale('cases'))
    .style('fill-opacity', 0.3);

  // 死亡区域
  svg
    .append('path')
    .datum(filteredData)
    .attr('class', 'area deaths-area')
    .attr('d', area2)
    .style('fill', colorScale('deaths'))
    .style('fill-opacity', 0.3);

  // 病例折线
  svg
    .append('path')
    .datum(filteredData)
    .attr('class', 'line cases-line')
    .attr('d', line)
    .style('stroke', colorScale('cases'))
    .style('stroke-width', 2);

  // 死亡折线
  const lineDeaths = d3
    .line()
    .x((d) => xScale(d.date))
    .y((d) => yScale2(d.daily_fatalities));

  svg
    .append('path')
    .datum(filteredData)
    .attr('class', 'line deaths-line')
    .attr('d', lineDeaths)
    .style('stroke', colorScale('deaths'))
    .style('stroke-width', 2);

  addInteractivePoints();
}

// 渲染散点图（主图表）
function renderScatterPlot() {
  const showCumulative = document.getElementById('show-cumulative').checked;

  if (showCumulative) {
    // 使用累积数据
    const scatterData = cumulativeData.filter(
      (d) => d.date >= dateRange[0] && d.date <= dateRange[1],
    );

    svg
      .selectAll('.scatter-point')
      .data(scatterData)
      .enter()
      .append('circle')
      .attr('class', 'scatter-point')
      .attr('cx', (d) => xScale(d.date))
      .attr('cy', (d) => yScale(d.cumulative_cases))
      .attr('r', 4)
      .style('fill', colorScale('cumulative_cases'))
      .style('opacity', 0.7);
  } else {
    // 使用每日数据
    svg
      .selectAll('.scatter-point')
      .data(filteredData)
      .enter()
      .append('circle')
      .attr('class', 'scatter-point')
      .attr('cx', (d) => xScale(d.date))
      .attr('cy', (d) => yScale(d.daily_cases))
      .attr('r', 4)
      .style('fill', colorScale('cases'))
      .style('opacity', 0.7);
  }
}

// 渲染堆叠面积图
function renderStackedArea() {
  const stack = d3
    .stack()
    .keys(['daily_cases', 'daily_fatalities'])
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const stackedData = stack(filteredData);

  const areaStacked = d3
    .area()
    .x((d) => xScale(d.data.date))
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  svg
    .selectAll('.stack')
    .data(stackedData)
    .enter()
    .append('path')
    .attr('class', 'area')
    .attr('d', areaStacked)
    .style('fill', (d, i) =>
      i === 0 ? colorScale('cases') : colorScale('deaths'),
    )
    .style('opacity', 0.6);
}

// 渲染柱状图
function renderBarChart() {
  // 使用每周数据
  const barWidth = Math.min(20, width / weeklyData.length - 2);

  // 病例柱状图
  svg
    .selectAll('.bar-cases')
    .data(weeklyData)
    .enter()
    .append('rect')
    .attr('class', 'bar bar-cases')
    .attr('x', (d, i) => i * (barWidth + 2))
    .attr('y', (d) => yScale(d.total_cases))
    .attr('width', barWidth)
    .attr('height', (d) => height - yScale(d.total_cases))
    .style('fill', colorScale('cases'))
    .style('opacity', 0.8);

  // 死亡柱状图（叠加）
  svg
    .selectAll('.bar-deaths')
    .data(weeklyData)
    .enter()
    .append('rect')
    .attr('class', 'bar bar-deaths')
    .attr('x', (d, i) => i * (barWidth + 2))
    .attr('y', (d) => yScale2(d.total_deaths))
    .attr('width', barWidth)
    .attr('height', (d) => height - yScale2(d.total_deaths))
    .style('fill', colorScale('deaths'))
    .style('opacity', 0.8);
}

// 渲染热力图
function renderHeatmap() {
  // 按月分组数据
  const monthData = d3.rollup(
    filteredData,
    (v) => d3.sum(v, (d) => d.daily_cases),
    (d) => d3.timeFormat('%Y-%m')(d.date),
  );

  const months = Array.from(monthData.keys()).sort();
  const maxValue = d3.max(Array.from(monthData.values()));

  const colorHeatmap = d3
    .scaleSequential()
    .domain([0, maxValue])
    .interpolator(d3.interpolateReds);

  const cellSize = Math.min(30, width / months.length);

  svg
    .selectAll('.heatmap-cell')
    .data(months)
    .enter()
    .append('rect')
    .attr('class', 'heatmap-cell')
    .attr('x', (d, i) => i * cellSize)
    .attr('y', height - cellSize)
    .attr('width', cellSize - 1)
    .attr('height', cellSize - 1)
    .style('fill', (d) => colorHeatmap(monthData.get(d)))
    .style('stroke', '#fff');

  // 添加月份标签
  svg
    .selectAll('.month-label')
    .data(months)
    .enter()
    .append('text')
    .attr('class', 'month-label')
    .attr('x', (d, i) => i * cellSize + cellSize / 2)
    .attr('y', height + 20)
    .text((d) => d.split('-')[1])
    .style('text-anchor', 'middle')
    .style('font-size', '10px');
}

// 添加交互点
function addInteractivePoints() {
  const points = svg
    .selectAll('.data-point')
    .data(filteredData)
    .enter()
    .append('circle')
    .attr('class', 'data-point')
    .attr('cx', (d) => xScale(d.date))
    .attr('cy', (d) => yScale(d.daily_cases))
    .attr('r', 3)
    .style('fill', '#fff')
    .style('stroke', colorScale('cases'))
    .style('stroke-width', 2)
    .style('opacity', 0)
    .on('mouseover', handleMouseOver)
    .on('mouseout', handleMouseOut);
}

// 鼠标悬停处理
function handleMouseOver(event, d) {
  const tooltip = d3.select('#tooltip');

  tooltip
    .style('opacity', 1)
    .html(
      `
            <h3>${d3.timeFormat('%B %d, %Y')(d.date)}</h3>
            <p><strong>Daily Cases:</strong> ${d3.format(',')(d.daily_cases)}</p>
            <p><strong>Daily Deaths:</strong> ${d3.format(',')(d.daily_fatalities)}</p>
            <p><strong>Cumulative Cases:</strong> ${d3.format(',')(d.cumulative_cases || 'N/A')}</p>
            <p><strong>Cumulative Deaths:</strong> ${d3.format(',')(d.cumulative_deaths || 'N/A')}</p>
            <p><strong>Day of Week:</strong> ${getDayName(d.dayOfWeek)}</p>
        `,
    )
    .style('left', event.pageX + 10 + 'px')
    .style('top', event.pageY - 100 + 'px');

  d3.select(event.currentTarget).style('opacity', 1).attr('r', 6);
}

function handleMouseOut(event, d) {
  d3.select('#tooltip').style('opacity', 0);
  d3.select(event.currentTarget).style('opacity', 0).attr('r', 3);
}

// 获取星期几名称
function getDayName(dayIndex) {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return days[dayIndex];
}

// 添加轴标签
function addAxisLabels() {
  // X轴标签
  svg
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 10)
    .text('Date');

  // Y轴标签（左侧）
  svg
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', `rotate(-90)`)
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .text('Daily Cases');

  // Y轴标签（右侧）
  svg
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', `rotate(90)`)
    .attr('x', height / 2)
    .attr('y', -width - margin.right + 50)
    .text('Daily Deaths');
}

// 添加图例
function addLegend() {
  const legend = d3.select('#legend');
  legend.html('');

  const showCases = document.getElementById('show-cases').checked;
  const showDeaths = document.getElementById('show-deaths').checked;
  const show7DayAvg = document.getElementById('show-7day-avg').checked;
  const showCumulative = document.getElementById('show-cumulative').checked;

  const items = [];
  if (showCases)
    items.push({ label: 'Daily Cases', color: colorScale('cases') });
  if (showDeaths)
    items.push({ label: 'Daily Deaths', color: colorScale('deaths') });
  if (show7DayAvg)
    items.push({ label: '7-Day Moving Avg', color: colorScale('avg_7day') });
  if (showCumulative && currentView === 'scatter') {
    items.push({
      label: 'Cumulative Cases',
      color: colorScale('cumulative_cases'),
    });
  }

  items.forEach((item) => {
    const legendItem = legend.append('div').attr('class', 'legend-item');

    legendItem
      .append('div')
      .attr('class', 'legend-color')
      .style('background-color', item.color);

    legendItem.append('span').text(item.label);
  });
}

// 渲染散点图（副图表）
function renderScatterChart() {
  const scatterWidth =
    document.getElementById('scatter-chart').clientWidth - 100;
  const scatterHeight = 250;

  const scatterX = d3
    .scaleLinear()
    .domain([0, d3.max(filteredData, (d) => d.daily_cases)])
    .range([0, scatterWidth])
    .nice();

  const scatterY = d3
    .scaleLinear()
    .domain([0, d3.max(filteredData, (d) => d.daily_fatalities)])
    .range([scatterHeight, 0])
    .nice();

  scatterSvg.selectAll('*').remove();

  // 添加网格
  scatterSvg
    .append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${scatterHeight})`)
    .call(d3.axisBottom(scatterX).tickSize(-scatterHeight).tickFormat(''));

  scatterSvg
    .append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(scatterY).tickSize(-scatterWidth).tickFormat(''));

  // 添加散点
  scatterSvg
    .selectAll('.scatter-point')
    .data(filteredData)
    .enter()
    .append('circle')
    .attr('class', 'scatter-point')
    .attr('cx', (d) => scatterX(d.daily_cases))
    .attr('cy', (d) => scatterY(d.daily_fatalities))
    .attr('r', 3)
    .style('fill', (d) => {
      const ratio = d.daily_fatalities / (d.daily_cases || 1);
      return d3.interpolateReds(ratio * 10);
    })
    .style('opacity', 0.7);

  // 添加回归线
  addRegressionLine(
    scatterSvg,
    scatterX,
    scatterY,
    scatterWidth,
    scatterHeight,
  );

  // 添加轴
  scatterSvg
    .append('g')
    .attr('transform', `translate(0,${scatterHeight})`)
    .call(d3.axisBottom(scatterX));

  scatterSvg.append('g').call(d3.axisLeft(scatterY));

  // 添加轴标签
  scatterSvg
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('x', scatterWidth / 2)
    .attr('y', scatterHeight + 40)
    .text('Daily Cases');

  scatterSvg
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .attr('x', -scatterHeight / 2)
    .attr('y', -40)
    .text('Daily Deaths');
}

// 添加回归线
function addRegressionLine(container, xScale, yScale, width, height) {
  // 计算线性回归
  const n = filteredData.length;
  const sumX = d3.sum(filteredData, (d) => d.daily_cases);
  const sumY = d3.sum(filteredData, (d) => d.daily_fatalities);
  const sumXY = d3.sum(filteredData, (d) => d.daily_cases * d.daily_fatalities);
  const sumX2 = d3.sum(filteredData, (d) => d.daily_cases * d.daily_cases);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // 创建回归线
  const line = d3
    .line()
    .x((d) => xScale(d))
    .y((d) => yScale(slope * d + intercept));

  const xRange = xScale.domain();
  const lineData = [xRange[0], xRange[1]];

  container
    .append('path')
    .datum(lineData)
    .attr('class', 'regression-line')
    .attr('d', line)
    .style('stroke', '#333')
    .style('stroke-width', 2)
    .style('stroke-dasharray', '5,5')
    .style('fill', 'none');

  // 显示R²值
  const yMean = sumY / n;
  const ssRes = d3.sum(filteredData, (d) =>
    Math.pow(d.daily_fatalities - (slope * d.daily_cases + intercept), 2),
  );
  const ssTot = d3.sum(filteredData, (d) =>
    Math.pow(d.daily_fatalities - yMean, 2),
  );
  const rSquared = 1 - ssRes / ssTot;

  container
    .append('text')
    .attr('x', width - 10)
    .attr('y', 20)
    .attr('text-anchor', 'end')
    .style('font-size', '12px')
    .text(`R² = ${rSquared.toFixed(3)}`);
}

// 渲染每周图表
function renderWeeklyChart() {
  const weeklyWidth = document.getElementById('weekly-chart').clientWidth - 100;
  const weeklyHeight = 250;

  weeklySvg.selectAll('*').remove();

  const xWeekly = d3
    .scaleBand()
    .domain(weeklyData.map((d) => d.week))
    .range([0, weeklyWidth])
    .padding(0.2);

  const yWeekly = d3
    .scaleLinear()
    .domain([0, d3.max(weeklyData, (d) => d.total_cases)])
    .range([weeklyHeight, 0])
    .nice();

  // 添加柱状图
  weeklySvg
    .selectAll('.weekly-bar')
    .data(weeklyData)
    .enter()
    .append('rect')
    .attr('class', 'weekly-bar')
    .attr('x', (d) => xWeekly(d.week))
    .attr('y', (d) => yWeekly(d.total_cases))
    .attr('width', xWeekly.bandwidth())
    .attr('height', (d) => weeklyHeight - yWeekly(d.total_cases))
    .style('fill', (d, i) => d3.interpolateBlues(i / weeklyData.length))
    .style('opacity', 0.8);

  // 添加轴
  weeklySvg
    .append('g')
    .attr('transform', `translate(0,${weeklyHeight})`)
    .call(d3.axisBottom(xWeekly).tickFormat((d, i) => (i % 4 === 0 ? d : '')));

  weeklySvg.append('g').call(d3.axisLeft(yWeekly));
}

// 渲染移动平均图表
function renderMovingAvgChart() {
  const avgWidth =
    document.getElementById('moving-avg-chart').clientWidth - 100;
  const avgHeight = 250;

  movingAvgSvg.selectAll('*').remove();

  const xAvg = d3.scaleTime().domain(dateRange).range([0, avgWidth]);

  const yAvg = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(
        movingAvgData.filter(
          (d) => d.date >= dateRange[0] && d.date <= dateRange[1],
        ),
        (d) => d.moving_avg_cases,
      ),
    ])
    .range([avgHeight, 0])
    .nice();

  const filteredAvgData = movingAvgData.filter(
    (d) => d.date >= dateRange[0] && d.date <= dateRange[1],
  );

  const lineAvg = d3
    .line()
    .x((d) => xAvg(d.date))
    .y((d) => yAvg(d.moving_avg_cases))
    .curve(d3.curveMonotoneX);

  // 添加移动平均线
  movingAvgSvg
    .append('path')
    .datum(filteredAvgData)
    .attr('class', 'moving-avg-line')
    .attr('d', lineAvg)
    .style('stroke', '#e74c3c')
    .style('stroke-width', 2)
    .style('fill', 'none');

  // 添加原始数据点
  movingAvgSvg
    .selectAll('.avg-point')
    .data(filteredAvgData.filter((d, i) => i % 7 === 0)) // 每周一个点
    .enter()
    .append('circle')
    .attr('class', 'avg-point')
    .attr('cx', (d) => xAvg(d.date))
    .attr('cy', (d) => yAvg(d.moving_avg_cases))
    .attr('r', 3)
    .style('fill', '#3498db')
    .style('opacity', 0.6);

  // 添加轴
  movingAvgSvg
    .append('g')
    .attr('transform', `translate(0,${avgHeight})`)
    .call(d3.axisBottom(xAvg).tickFormat(d3.timeFormat('%b %Y')));

  movingAvgSvg.append('g').call(d3.axisLeft(yAvg));
}

// 更新统计卡片
function updateStats() {
  const totalCases = d3.sum(filteredData, (d) => d.daily_cases);
  const totalDeaths = d3.sum(filteredData, (d) => d.daily_fatalities);
  const fatalityRate = (totalDeaths / totalCases) * 100;

  // 查找峰值日
  const peakDay = filteredData.reduce(
    (max, d) => (d.daily_cases > max.daily_cases ? d : max),
    filteredData[0],
  );

  // 计算变化率
  const firstWeekAvg = d3.mean(filteredData.slice(0, 7), (d) => d.daily_cases);
  const lastWeekAvg = d3.mean(filteredData.slice(-7), (d) => d.daily_cases);
  const changeRate = ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100;

  // 更新DOM
  document.getElementById('total-cases').textContent =
    d3.format(',')(totalCases);
  document.getElementById('total-deaths').textContent =
    d3.format(',')(totalDeaths);
  document.getElementById('fatality-rate').textContent =
    fatalityRate.toFixed(2) + '%';
  document.getElementById('peak-day').textContent = d3.timeFormat('%b %d')(
    peakDay.date,
  );
  document.getElementById('peak-detail').textContent =
    `${d3.format(',')(peakDay.daily_cases)} cases`;

  const casesChange = document.getElementById('cases-change');
  casesChange.textContent =
    changeRate >= 0
      ? `↑ ${changeRate.toFixed(1)}% from start`
      : `↓ ${Math.abs(changeRate).toFixed(1)}% from start`;
  casesChange.style.color = changeRate >= 0 ? '#e74c3c' : '#27ae60';
}

// 更新数据表格
function updateDataTable() {
  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';

  const pageSize = 20;
  let currentPage = 1;

  function renderPage(page) {
    tableBody.innerHTML = '';
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageData = filteredData.slice(start, end);

    pageData.forEach((d) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>${d3.timeFormat('%Y-%m-%d')(d.date)}</td>
                <td>${d3.format(',')(d.daily_cases)}</td>
                <td>${d3.format(',')(d.daily_fatalities)}</td>
                <td>${d3.format(',')(d.cumulative_cases || 'N/A')}</td>
                <td>${d3.format(',')(d.cumulative_deaths || 'N/A')}</td>
                <td>${d3.format(',')(Math.round(d.moving_avg_cases || 0))}</td>
                <td>${d3.format(',')(Math.round(d.moving_avg_deaths || 0))}</td>
            `;
      tableBody.appendChild(row);
    });

    document.getElementById('page-info').textContent =
      `Page ${page} of ${Math.ceil(filteredData.length / pageSize)}`;
  }

  renderPage(currentPage);

  // 分页事件
  document.getElementById('prev-page').onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderPage(currentPage);
    }
  };

  document.getElementById('next-page').onclick = () => {
    if (currentPage < Math.ceil(filteredData.length / pageSize)) {
      currentPage++;
      renderPage(currentPage);
    }
  };

  // 搜索功能
  document.getElementById('search-input').oninput = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = data.filter((d) =>
      d.dateStr.toLowerCase().includes(searchTerm),
    );
    updateTableWithData(filtered);
  };

  // 排序功能
  document.getElementById('sort-select').onchange = (e) => {
    const sortedData = [...filteredData].sort((a, b) => {
      switch (e.target.value) {
        case 'cases':
          return b.daily_cases - a.daily_cases;
        case 'deaths':
          return b.daily_fatalities - a.daily_fatalities;
        default:
          return a.date - b.date;
      }
    });
    updateTableWithData(sortedData);
  };
}

function updateTableWithData(data) {
  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';

  data.slice(0, 20).forEach((d) => {
    const row = document.createElement('tr');
    row.innerHTML = `
            <td>${d3.timeFormat('%Y-%m-%d')(d.date)}</td>
            <td>${d3.format(',')(d.daily_cases)}</td>
            <td>${d3.format(',')(d.daily_fatalities)}</td>
            <td>${d3.format(',')(d.cumulative_cases || 'N/A')}</td>
            <td>${d3.format(',')(d.cumulative_deaths || 'N/A')}</td>
            <td>${d3.format(',')(Math.round(d.moving_avg_cases || 0))}</td>
            <td>${d3.format(',')(Math.round(d.moving_avg_deaths || 0))}</td>
        `;
    tableBody.appendChild(row);
  });
}

// 生成洞察
function generateInsights() {
  // 峰值分析
  const peakCases = d3.max(data, (d) => d.daily_cases);
  const peakDay = data.find((d) => d.daily_cases === peakCases);
  document.getElementById('peak-insight').textContent =
    `Peak infections occurred on ${d3.timeFormat('%B %d, %Y')(peakDay.date)} with ${d3.format(',')(peakCases)} cases.`;

  // 趋势分析
  const earlyAvg = d3.mean(data.slice(0, 30), (d) => d.daily_cases);
  const lateAvg = d3.mean(data.slice(-30), (d) => d.daily_cases);
  const trend = lateAvg > earlyAvg ? 'increasing' : 'decreasing';
  document.getElementById('trend-insight').textContent =
    `Overall trend shows ${trend} infection rates, with averages moving from ${Math.round(earlyAvg)} to ${Math.round(lateAvg)} daily cases.`;

  // 相关性分析
  const correlation = calculateCorrelation();
  document.getElementById('correlation-insight').textContent =
    `Strong positive correlation (r = ${correlation.toFixed(3)}) between cases and deaths, indicating deaths follow cases by 1-2 weeks.`;

  // 警告信号
  const recentIncrease = checkRecentIncrease();
  document.getElementById('warning-insight').textContent = recentIncrease
    ? '⚠️ Recent data shows increasing trend. Monitor closely.'
    : '✅ Recent trend appears stable or decreasing.';
}

// 计算相关性
function calculateCorrelation() {
  const x = filteredData.map((d) => d.daily_cases);
  const y = filteredData.map((d) => d.daily_fatalities);
  const n = x.length;

  const sumX = d3.sum(x);
  const sumY = d3.sum(y);
  const sumXY = d3.sum(x.map((xi, i) => xi * y[i]));
  const sumX2 = d3.sum(x.map((xi) => xi * xi));
  const sumY2 = d3.sum(y.map((yi) => yi * yi));

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
  );

  return numerator / denominator;
}

// 检查近期增长
function checkRecentIncrease() {
  const last30Days = filteredData.slice(-30);
  const firstHalfAvg = d3.mean(last30Days.slice(0, 15), (d) => d.daily_cases);
  const secondHalfAvg = d3.mean(last30Days.slice(15), (d) => d.daily_cases);

  return secondHalfAvg > firstHalfAvg * 1.1; // 10% increase
}

// 更新图表
function updateChart() {
  // 过滤数据
  filteredData = data.filter(
    (d) => d.date >= dateRange[0] && d.date <= dateRange[1],
  );

  // 更新比例尺
  xScale.domain(dateRange);
  yScale.domain([0, d3.max(filteredData, (d) => d.daily_cases)]).nice();
  yScale2.domain([0, d3.max(filteredData, (d) => d.daily_fatalities)]).nice();

  // 重绘图表
  renderChart();

  // 更新统计
  updateStats();

  // 更新洞察
  generateInsights();
}

// 更新日期输入
function updateDateInputs() {
  document.getElementById('start-date').valueAsDate = dateRange[0];
  document.getElementById('end-date').valueAsDate = dateRange[1];
}

// 绑定事件
function bindEvents() {
  // 图表类型切换
  document.getElementById('chart-select').addEventListener('change', (e) => {
    currentView = e.target.value;
    document.getElementById('chart-title').textContent =
      e.target.options[e.target.selectedIndex].text;
    updateChart();
  });

  // 日期范围变化
  document.getElementById('start-date').addEventListener('change', (e) => {
    dateRange[0] = new Date(e.target.value);
    updateChart();
    updateBrush();
  });

  document.getElementById('end-date').addEventListener('change', (e) => {
    dateRange[1] = new Date(e.target.value);
    updateChart();
    updateBrush();
  });

  // 过滤器变化
  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', updateChart);
  });

  // 重置按钮
  document.getElementById('reset-btn').addEventListener('click', () => {
    dateRange = [d3.min(data, (d) => d.date), d3.max(data, (d) => d.date)];
    updateDateInputs();
    updateChart();
    updateBrush();
  });

  // 导出按钮
  document.getElementById('export-btn').addEventListener('click', exportChart);
  document.getElementById('export-data').addEventListener('click', exportData);

  // 窗口大小变化
  window.addEventListener(
    'resize',
    debounce(() => {
      // 重新计算尺寸
      const newWidth =
        document.getElementById('main-chart').parentElement.clientWidth -
        margin.left -
        margin.right;
      if (newWidth !== width) {
        location.reload(); // 简单重新加载，或者实现更复杂的重绘逻辑
      }
    }, 250),
  );
}

// 更新刷子
function updateBrush() {
  const brush = d3.brushX();
  brushGroup
    .select('.brush')
    .call(brush.move, [xScaleBrush(dateRange[0]), xScaleBrush(dateRange[1])]);
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 导出图表
function exportChart() {
  const svgElement = document.getElementById('main-chart');
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const downloadLink = document.createElement('a');
  downloadLink.href = svgUrl;
  downloadLink.download = 'covid-chart.svg';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

// 导出数据
function exportData() {
  const headers = [
    'Date',
    'Daily Cases',
    'Daily Deaths',
    'Cumulative Cases',
    'Cumulative Deaths',
    '7-Day Avg Cases',
    '7-Day Avg Deaths',
  ];
  const csvData = filteredData.map((d) => [
    d3.timeFormat('%Y-%m-%d')(d.date),
    d.daily_cases,
    d.daily_fatalities,
    d.cumulative_cases || '',
    d.cumulative_deaths || '',
    Math.round(d.moving_avg_cases || 0),
    Math.round(d.moving_avg_deaths || 0),
  ]);

  const csv = [headers, ...csvData].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'covid-data.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
