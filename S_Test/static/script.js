const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

let driverBarChart = null;
const colorClasses = ['color-blue', 'color-orange', 'color-green', 'color-purple', 'color-red', 'color-cyan'];

Promise.all([
  fetch('R.json').then(res => res.json()),
  fetch('Q.json').then(res => res.json()),
  fetch('P.json').then(res => res.json())
]).then(([data, qData, penaltiesData]) => {
  let driversSet = new Set();
  let raceLabels = [];
  let raceLabelsShort = [];
  let totalPoints = {};
  let teamPoints = {};
  let stats = {};
  let racePoints = {};
  let teamMap = {};
  let penaltiesMap = {};

  // 初始化 penaltiesMap
  penaltiesData.races.forEach(race => {
    penaltiesMap[race.round] = race.results || [];
  });

  data.races.forEach(race => {
    race.results.forEach(res => {
      driversSet.add(res.driver);
      if (res.team) {
        teamMap[res.driver] = res.team;
      }
    });
  });

  data.races.forEach(race => {
    raceLabels.push(race.raceName);
    raceLabelsShort.push(race.raceName.slice(0, 2));
  });

  driversSet.forEach(driver => {
    totalPoints[driver] = [];
    stats[driver] = {
      wins: 0,
      podiums: 0,
      dnfs: 0,
      points: 0,
      poleCount: 0,
      licensePoints: 12,
      suspendedRounds: []
    };
    racePoints[driver] = [];
  });

  Object.values(teamMap).forEach(team => {
    teamPoints[team] = [];
  });

  data.races.forEach((race, raceIndex) => {
    let thisRacePoints = {};
    let raceTotalPoints = 0;

    race.results.forEach(res => {
      const driver = res.driver;

      if (stats[driver].suspendedRounds.includes(race.round)) {
        thisRacePoints[driver] = 0;
        return;
      }

      const pos = res.position;
      let pts = (pos <= 10) ? pointsTable[pos - 1] : 0;
      thisRacePoints[driver] = pts;
      raceTotalPoints += pts;

      if (pos === 1) stats[driver].wins++;
      if (pos >= 1 && pos <= 3) stats[driver].podiums++;
      if (pos === 21) stats[driver].dnfs++;
    });

    const flDriver = race.fastestLap;
    if (flDriver && flDriver !== '/') {
      let top10 = race.results.filter(res => res.position <= 10).map(res => res.driver);
      if (top10.includes(flDriver)) {
        thisRacePoints[flDriver] = (thisRacePoints[flDriver] || 0) + 1;
        raceTotalPoints += 1;
      }
    }

    const qRace = qData.races.find(q => q.round === race.round);
    if (qRace) {
      qRace.results.forEach(res => {
        if (res.position === 1) {
          stats[res.driver].poleCount++;
        }
      });
    }

    const penaltiesRace = penaltiesMap[race.round] || [];
    penaltiesRace.forEach(penalty => {
      const driver = penalty.driver;
      if (!stats[driver]) return;
      if (penalty.pointsDeducted) {
        stats[driver].licensePoints -= penalty.pointsDeducted;
        if (stats[driver].licensePoints <= 0) {
          stats[driver].licensePoints = 12;
          const nextRound = race.round + 1;
          stats[driver].suspendedRounds.push(nextRound);
        }
      }
    });

    // 初始化本轮车队积分为上一轮累计值
    Object.keys(teamPoints).forEach(team => {
      teamPoints[team][raceIndex] = raceIndex > 0 ? teamPoints[team][raceIndex - 1] : 0;
    });

    driversSet.forEach(driver => {
      const prev = raceIndex > 0 ? totalPoints[driver][raceIndex - 1] : 0;
      const curr = thisRacePoints[driver] || 0;
      totalPoints[driver][raceIndex] = prev + curr;
      racePoints[driver][raceIndex] = curr;

      const team = teamMap[driver];
      if (team) {
        teamPoints[team][raceIndex] += curr;
      }
    });

    race.results.forEach(res => {
      stats[res.driver].points = totalPoints[res.driver][raceIndex];
    });
  });

  let latestTotals = [];
  driversSet.forEach(d => {
    let sum = totalPoints[d][totalPoints[d].length - 1] || 0;
    latestTotals.push({ driver: d, points: sum });
  });

  let prevTotals = [];
  driversSet.forEach(d => {
    let len = totalPoints[d].length;
    let prevSum = len >= 2 ? totalPoints[d][len - 2] : 0;
    prevTotals.push({ driver: d, points: prevSum });
  });

  let prevSorted = [...prevTotals].sort((a, b) => b.points - a.points);
  let prevRankMap = {};
  prevSorted.forEach((item, idx) => {
    prevRankMap[item.driver] = idx + 1;
  });

  let sortedByPoints = [...latestTotals].sort((a, b) => b.points - a.points);

  let standingsHtml = "";
  sortedByPoints.forEach((item, idx) => {
    let driver = item.driver;
    let prevRank = prevRankMap[driver] || idx + 1;
    let rankChange = prevRank - (idx + 1);

    let icon = "";
    if (rankChange > 0) {
      icon = `<span style="color:green;">▲</span>`;
    } else if (rankChange < 0) {
      icon = `<span style="color:red;">▼</span>`;
    }

    standingsHtml += `<li class="list-group-item" data-driver="${driver}">
      <div>
        <span class="me-2">${String(idx + 1).padStart(2, '0')}</span>
        <span class="driver-name">${driver}</span>
        <span class="team-name ms-2">(${teamMap[driver] || '-'})</span>
      </div>
      <div class="driver-points d-flex align-items-center">
        ${icon}
        <span class="ms-2">${item.points} 分</span>
      </div>
    </li>`;
  });
  document.getElementById('standings').innerHTML = standingsHtml;

  let teamLatestTotals = Object.entries(teamPoints).map(([team, arr]) => ({
    team,
    points: arr[arr.length - 1] || 0,
    data: arr
  }));
  teamLatestTotals.sort((a, b) => b.points - a.points);

  let teamHtml = "";
  teamLatestTotals.forEach((item, idx) => {
    teamHtml += `<li class="list-group-item">
      <div><span class="me-2">${String(idx + 1).padStart(2, '0')}</span><span class="driver-name">${item.team}</span></div>
      <div class="team-points">${item.points} 分</div>
    </li>`;
  });
  document.getElementById('teamStandings').innerHTML = teamHtml;

  const colorPalette = [
    "#3366CC", "#DC3912", "#FF9900", "#109618",
    "#990099", "#3B3EAC", "#0099C6", "#DD4477",
    "#66AA00", "#B82E2E", "#316395", "#994499",
    "#22AA99", "#AAAA11", "#6633CC", "#E67300",
    "#8B0707", "#651067", "#329262", "#5574A6",
    "#3B3EAC"
  ];

  let driverDatasets = sortedByPoints.map((item, idx) => ({
    label: item.driver,
    data: totalPoints[item.driver],
    borderColor: colorPalette[idx % colorPalette.length],
    backgroundColor: colorPalette[idx % colorPalette.length],
    borderWidth: 2,
    fill: false
  }));

  new Chart(document.getElementById('driverTrend'), {
    type: 'line',
    data: {
      labels: raceLabels,
      datasets: driverDatasets
    },
    options: {
      responsive: true,
      aspectRatio: window.innerWidth < 768 ? 0.6 : 2.5,
      plugins: {
        legend: { display: true }
      }
    }
  });

  let teamDatasets = teamLatestTotals.map((item, idx) => ({
    label: item.team,
    data: item.data,
    borderColor: colorPalette[idx % colorPalette.length],
    backgroundColor: colorPalette[idx % colorPalette.length],
    borderWidth: 2,
    fill: false
  }));

  new Chart(document.getElementById('teamTrend'), {
    type: 'line',
    data: {
      labels: raceLabels,
      datasets: teamDatasets
    },
    options: {
      responsive: true,
      aspectRatio: window.innerWidth < 768 ? 0.6 : 2.5,
      plugins: {
        legend: { display: true }
      }
    }
  });

  document.querySelectorAll('#standings .list-group-item').forEach(el => {
    el.addEventListener('click', () => {
      const driver = el.dataset.driver;
      const s = stats[driver];
      document.getElementById('driverModalLabel').innerText = driver;
      document.getElementById('driverModalBody').innerHTML = `
        <p><strong>总积分：</strong>${s.points}</p>
        <p><strong>获胜次数：</strong>${s.wins}</p>
        <p><strong>领奖台次数：</strong>${s.podiums}</p>
        <p><strong>未完赛次数：</strong>${s.dnfs}</p>
        <p><strong>杆位次数：</strong>${s.poleCount}</p>
        <p><strong>驾照分：</strong>${s.licensePoints}</p>
        <canvas id="driverBarChart" height="300"></canvas>
      `;

      if (driverBarChart) driverBarChart.destroy();

      driverBarChart = new Chart(document.getElementById('driverBarChart'), {
        type: 'bar',
        data: {
          labels: raceLabelsShort,
          datasets: [{
            label: '每场积分',
            data: racePoints[driver],
            backgroundColor: '#ff6f00'
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } }
        }
      });

      new bootstrap.Modal(document.getElementById('driverModal')).show();
    });
  });

  document.getElementById('raceCards').innerHTML = "";
  [...data.races].reverse().forEach((race, raceIndex) => {
    let colorClass = colorClasses[raceIndex % colorClasses.length];
    let html = `
      <div class="col-lg-6 col-md-12">
        <div class="card p-3">
          <h3 class="${colorClass}">（第${race.round}轮）${race.raceName} (${race.date})</h3>
          <ul class="nav nav-tabs mt-2">
            <li class="nav-item">
              <a class="nav-link active" data-bs-toggle="tab" href="#race-tab-${race.round}">正赛</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" data-bs-toggle="tab" href="#qualifying-tab-${race.round}">排位赛</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" data-bs-toggle="tab" href="#penalty-tab-${race.round}">判罚情况</a>
            </li>
          </ul>
          <div class="tab-content mt-3">
            <div class="tab-pane fade show active" id="race-tab-${race.round}">
              <p><strong class="${colorClass}">最快圈：</strong> ${race.fastestLap === '/' ? '无最快圈' : race.fastestLap}</p>
              <ul class="list-group">`;

    race.results.forEach(res => {
      const driver = res.driver;
      const posText = res.position === 21 ? '退赛' : String(res.position);
      const pts = racePoints[driver][race.round - 1] || 0;
      html += `<li class="list-group-item">
          <div><span class="me-2">${posText.padStart(2, '0')}</span><span class="driver-name">${driver}</span></div>
          <div class="driver-points ${colorClass}">${pts} 分</div>
        </li>`;
    });

    html += `</ul></div>`;

    const qRace = qData.races.find(q => q.round === race.round);
    if (qRace) {
      html += `
        <div class="tab-pane fade" id="qualifying-tab-${race.round}">
          <ul class="list-group">`;
      qRace.results.forEach(res => {
        const driver = res.driver;
        const posText = res.position === 21 ? '退赛' : String(res.position);
        const rlt = res.rlt || '/';
        html += `<li class="list-group-item">
          <div><span class="me-2">${posText.padStart(2, '0')}</span><span class="driver-name">${driver}</span></div>
          <div class="driver-points ${colorClass}">${rlt}</div>
        </li>`;
      });
      html += `</ul></div>`;
    }

    const penalties = penaltiesMap[race.round];
    html += `
      <div class="tab-pane fade" id="penalty-tab-${race.round}">
        <ul class="list-group">`;
    if (penalties && penalties.length > 0) {
      penalties.forEach(penalty => {
        html += `<li class="list-group-item">
          <div><span class="driver-name">${penalty.driver}</span></div>
          <div class="penalty-text">
            ${penalty.reason} → ${penalty.penalty} → 驾照分扣${penalty.pointsDeducted || 0}分
          </div>
        </li>`;
      });
    } else {
      html += `<li class="list-group-item penalty-text">本场无判罚记录</li>`;
    }
    html += `</ul></div>`;

    html += `</div></div></div>`;
    document.getElementById('raceCards').innerHTML += html;
  });
});
