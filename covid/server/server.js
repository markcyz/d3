const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// API端点：获取数据
app.get('/api/data', (req, res) => {
  const data = [];
  fs.createReadStream(path.join(__dirname, '../data/covid_data.csv'))
    .pipe(csv())
    .on('data', (row) => {
      // 解析数据
      const [day, month, year] = row.date.split('/');
      data.push({
        date: new Date(year, month - 1, day),
        dateStr: row.date,
        daily_cases: +row.daily_cases,
        daily_fatalities: +row.daily_fatalities,
        region: row.region,
      });
    })
    .on('end', () => {
      // 按日期排序
      data.sort((a, b) => a.date - b.date);

      // 计算累积数据
      let totalCases = 0;
      let totalDeaths = 0;
      const enrichedData = data.map((d) => {
        totalCases += d.daily_cases;
        totalDeaths += d.daily_fatalities;
        return {
          ...d,
          cumulative_cases: totalCases,
          cumulative_deaths: totalDeaths,
        };
      });

      res.json({
        success: true,
        data: enrichedData,
        summary: {
          total_cases: totalCases,
          total_deaths: totalDeaths,
          fatality_rate: (totalDeaths / totalCases) * 100,
          date_range: {
            start: data[0].date,
            end: data[data.length - 1].date,
          },
        },
      });
    })
    .on('error', (error) => {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    });
});

// API端点：获取统计数据
app.get('/api/stats', (req, res) => {
  // 这里可以添加更复杂的统计分析
  res.json({
    success: true,
    stats: {
      peak_months: calculatePeakMonths(),
      weekly_pattern: calculateWeeklyPattern(),
      correlations: calculateCorrelations(),
    },
  });
});

function calculatePeakMonths() {
  // 实现月份峰值计算
  return [];
}

function calculateWeeklyPattern() {
  // 实现每周模式计算
  return {};
}

function calculateCorrelations() {
  // 实现相关性计算
  return {};
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
